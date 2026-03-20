/**
 * api/generate-report.js
 *
 * Vercel Serverless Function — AI Report Writer
 * POST /api/generate-report
 *
 * Request body (JSON):
 *   {
 *     projectName:        string,
 *     projectDescription: string,
 *     photos:             string[],  // array of photo descriptions / captions
 *     customPrompt:       string     // optional additional instructions
 *   }
 *
 * Required headers:
 *   Authorization: Bearer <supabase_jwt>
 *   Content-Type: application/json
 *
 * Response:
 *   { report: "...generated text..." }
 *   or { error: "..." } on failure
 *
 * Environment variables (set in Vercel project settings):
 *   ANTHROPIC_API_KEY        — your Anthropic API key
 *   SUPABASE_URL             — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (for usage tracking)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-3-5-haiku-20241022';
const MAX_TOKENS        = 2000;
const SYSTEM_PROMPT     =
  'You are an expert construction/restoration project report writer. ' +
  'Write professional, detailed reports based on the provided project information. ' +
  'Use clear headings, bullet points where appropriate, and formal business language.';

export default async function handler(req, res) {
  // ── CORS headers (adjust origin in production) ────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth: verify Supabase JWT ─────────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization token' });
  }

  // Validate the token by calling Supabase /auth/v1/user
  let userId = null;
  let orgId  = null;
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey     = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey:        anonKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!userRes.ok) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      const userJson = await userRes.json();
      userId = userJson?.id;
    }
    // If env vars not set, skip auth check (dev/staging only)
  } catch (authErr) {
    console.warn('[generate-report] Auth check failed:', authErr.message);
    // Non-fatal in development; in production you should return 401 here
  }

  // ── Parse request body ────────────────────────────────────────────────────
  const {
    projectName        = 'Unnamed Project',
    projectDescription = '',
    photos             = [],
    customPrompt       = '',
  } = req.body || {};

  // Build the user message
  let userMessage = `Please write a professional project report for the following:\n\n`;
  userMessage    += `**Project Name:** ${projectName}\n\n`;

  if (projectDescription) {
    userMessage += `**Project Description:**\n${projectDescription}\n\n`;
  }

  if (photos && photos.length > 0) {
    userMessage += `**Photos / Site Observations (${photos.length} photos):**\n`;
    photos.slice(0, 20).forEach((desc, i) => {
      if (typeof desc === 'string' && desc.trim()) {
        userMessage += `  ${i + 1}. ${desc.trim()}\n`;
      }
    });
    userMessage += '\n';
  }

  if (customPrompt && customPrompt.trim()) {
    userMessage += `**Additional Instructions:**\n${customPrompt.trim()}\n\n`;
  }

  userMessage +=
    'Please provide a comprehensive, professional report with:\n' +
    '- Executive Summary\n' +
    '- Site Conditions\n' +
    '- Findings and Observations\n' +
    '- Recommendations\n' +
    '- Next Steps\n';

  // ── Check Anthropic key ───────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.error('[generate-report] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // ── Call Claude API ───────────────────────────────────────────────────────
  let reportText = '';
  let inputTokens  = 0;
  let outputTokens = 0;

  try {
    const claudeRes = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error('[generate-report] Claude API error:', claudeRes.status, errBody);
      return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
    }

    const claudeData = await claudeRes.json();
    reportText   = claudeData.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('') || '';
    inputTokens  = claudeData.usage?.input_tokens  || 0;
    outputTokens = claudeData.usage?.output_tokens || 0;

    if (!reportText.trim()) {
      return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });
    }
  } catch (claudeErr) {
    console.error('[generate-report] Fetch error:', claudeErr);
    return res.status(502).json({ error: 'Failed to reach AI service. Please check your connection.' });
  }

  // ── Track usage in ai_usage table (fire-and-forget) ──────────────────────
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;

    if (serviceKey && supabaseUrl && userId) {
      // Upsert into ai_usage — uses service role to bypass RLS
      await fetch(`${supabaseUrl}/rest/v1/ai_usage`, {
        method:  'POST',
        headers: {
          apikey:         serviceKey,
          Authorization:  `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer:         'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id:       userId,
          feature:       'generate-report',
          model:         MODEL,
          input_tokens:  inputTokens,
          output_tokens: outputTokens,
          created_at:    new Date().toISOString(),
        }),
      });
    }
  } catch (usageErr) {
    // Non-fatal — don't fail the request over tracking
    console.warn('[generate-report] Usage tracking failed:', usageErr.message);
  }

  // ── Return the report ─────────────────────────────────────────────────────
  return res.status(200).json({ report: reportText.trim() });
}
