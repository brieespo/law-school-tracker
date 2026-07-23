// Sends an uploaded syllabus PDF to Claude and extracts structured JSON:
// dated assignments, recurring patterns (not expanded into rows), and
// undated notes (exam format, policies, participation weight). Nothing is
// written to the database here — this function only extracts; the client's
// review screen decides what to commit. Same auth + ANTHROPIC_API_KEY
// pattern as the assistant function: the Anthropic key lives only in
// Supabase secrets, and access is restricted to ALLOWED_EMAIL — anyone else
// with a Supabase Auth account on this shared project (every sibling app
// shares it) gets a 401, since a valid JWT alone only proves "some signed-up
// user," not "Bri."
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYLLABUS_TOOL = {
  name: 'emit_syllabus',
  description: 'Turn a course syllabus into structured assignments, recurring patterns, and notes.',
  input_schema: {
    type: 'object',
    properties: {
      course_name_guess: { type: 'string', description: 'Best guess at the course name/code from the syllabus header, for matching against the student\'s course list. Empty string if unclear.' },
      assignments: {
        type: 'array',
        description: 'Individually dated items only — each must have a specific calendar date stated or unambiguously computable from the syllabus (e.g. an explicit date, or "Week 3" next to a printed calendar). Do not invent a date from a vague reference alone. Recurring/undated items go in recurring_patterns instead.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short assignment title, e.g. "Midterm Exam" or "Reading response #3".' },
            due_date: { type: 'string', description: 'YYYY-MM-DD. Required — omit the assignment entirely if no real date is available.' },
            type: { type: 'string', enum: ['reading', 'paper', 'exam', 'other'] },
          },
          required: ['title', 'due_date', 'type'],
        },
      },
      recurring_patterns: {
        type: 'array',
        description: 'Recurring, non-dated obligations stated as a rule rather than a list of dates, e.g. "Reading assignment due before each class" or "Weekly response paper due Sundays by midnight." Capture ONE entry per rule — never expand a recurring rule into individual dated rows.',
        items: {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description'],
        },
      },
      notes: {
        type: 'array',
        description: 'Undated but important information: exam format, grading breakdown, participation weight, attendance policy, late-work policy, materials, contact/office-hours info, etc.',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['exam_format', 'policy', 'participation', 'grading', 'other'] },
            text: { type: 'string' },
          },
          required: ['category', 'text'],
        },
      },
    },
    required: ['course_name_guess', 'assignments', 'recurring_patterns', 'notes'],
  },
};

const SYSTEM_PROMPT = `You extract structured information from a law school course syllabus PDF for a student's tracking app. Call emit_syllabus exactly once.

Rules:
- assignments: only items with a real, specific due date (an explicit date, or a date computable from an unambiguous printed course calendar). Never guess a date from a vague week number with no calendar to anchor it — leave it out or capture it as a recurring pattern instead.
- recurring_patterns: rules like "reading due before every class" or "weekly quiz on Fridays" — capture the rule once, never expand it into one row per class/week.
- notes: undated but useful context — exam format, grading weights, participation/attendance policy, late-work policy, materials, contact info. Keep each note focused on one topic.
- Syllabi are messy: tables, inconsistent formatting, OCR artifacts. Do your best to parse structure even when the layout is irregular. If something is illegible or ambiguous, skip it rather than guessing.
- course_name_guess should be the course name or code as printed (e.g. "Evidence — LAW 823"), or an empty string if the syllabus doesn't clearly state one.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    const allowedEmail = Deno.env.get('ALLOWED_EMAIL');
    if (!user || !allowedEmail || user.email !== allowedEmail) {
      return new Response(JSON.stringify({ error: 'Not authorized for syllabus import.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { pdfBase64 } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'No PDF provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // 32MB request limit on the Anthropic side; base64 runs ~1.37x the raw
    // bytes, so reject comfortably before that to fail fast with a clear error.
    if (pdfBase64.length > 24 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'PDF is too large (max ~18MB).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Syllabus import is not configured yet (missing ANTHROPIC_API_KEY secret).' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 8192,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Extract this syllabus into emit_syllabus.' },
          ],
        }],
        tools: [SYLLABUS_TOOL],
        tool_choice: { type: 'tool', name: 'emit_syllabus' },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error', anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: `Syllabus extraction failed (${anthropicRes.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await anthropicRes.json();
    const toolUse = (data.content || []).find((b: { type: string }) => b.type === 'tool_use');
    if (!toolUse) {
      return new Response(JSON.stringify({ error: 'Could not extract structured data from that PDF.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(toolUse.input), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: `Unexpected error: ${(e as Error).message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
