/**
 * api/generate-report.js
 *
 * Vercel Serverless Function — AI hub (two features, one function)
 *
 * ── Feature: report writer (default) ────────────────────────────────────────
 * POST /api/generate-report
 * Body: { projectName, projectDescription, photos[], customPrompt }
 * Response: { report: "..." }
 *
 * ── Feature: project assistant ──────────────────────────────────────────────
 * POST /api/generate-report   { feature: "assistant", projectId, message, history[], context{} }
 * Response: { reply: "..." }
 *
 * Required headers:
 *   Authorization: Bearer <supabase_jwt>
 *   Content-Type: application/json
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY         — Anthropic API key
 *   SUPABASE_URL              — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (usage tracking)
 *   VITE_SUPABASE_ANON_KEY   — anon key (JWT validation)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-3-5-haiku-20241022';

// ── Shared: verify Supabase JWT ───────────────────────────────────────────────
async function verifyToken(token) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const userJson = await userRes.json();
  return userJson?.id || null;
}

// ── Shared: call Claude ───────────────────────────────────────────────────────
async function callClaude({ system, messages, maxTokens }) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

  const claudeRes = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'x-api-key':         anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text();
    console.error('[generate-report] Claude API error:', claudeRes.status, errBody);
    throw new Error('AI service returned an error');
  }

  const claudeData = await claudeRes.json();
  const text = claudeData.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';
  return {
    text,
    inputTokens:  claudeData.usage?.input_tokens  || 0,
    outputTokens: claudeData.usage?.output_tokens || 0,
  };
}

// ── Shared: fire-and-forget usage log ────────────────────────────────────────
function logUsage({ userId, projectId, feature, inputTokens, outputTokens, extra = {} }) {
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!serviceKey || !supabaseUrl || !userId) return;

  fetch(`${supabaseUrl}/rest/v1/ai_usage`, {
    method:  'POST',
    headers: {
      apikey:         serviceKey,
      Authorization:  `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer:         'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id:       userId,
      feature,
      model:         MODEL,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      created_at:    new Date().toISOString(),
      ...extra,
    }),
  }).catch(e => console.warn('[generate-report] Usage log failed:', e.message));
}

// ── Feature: room summary ─────────────────────────────────────────────────────
async function handleRoomSummary(req, res, userId) {
  const { roomId, projectId, context: ctx = {} } = req.body || {};
  if (!roomId)    return res.status(400).json({ error: 'roomId is required' });
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const systemPrompt = [
    'You are a construction/restoration field assistant. Summarize the current state of a single room.',
    'Be concise, practical, and factual. Use plain language. Keep it under 200 words.',
    'Do not make up information. If data is sparse, say so briefly.',
    '',
    '── ROOM CONTEXT ───────────────────────────────────────────',
    ctx.roomName        ? `Room:          ${ctx.roomName}`        : '',
    ctx.projectTitle    ? `Project:       ${ctx.projectTitle}`    : '',
    ctx.projectAddress  ? `Address:       ${ctx.projectAddress}`  : '',
    ctx.status          ? `Status:        ${ctx.status}`          : '',
    ctx.notes           ? `Notes:         ${ctx.notes}`           : '',
    ctx.labels?.length  ? `Labels:        ${ctx.labels.join(', ')}` : '',
    ctx.taskSummary     ? `Tasks:         ${ctx.taskSummary}`     : '',
    ctx.photoCount      ? `Photos:        ${ctx.photoCount}`      : '',
    '───────────────────────────────────────────────────────────',
  ].filter(Boolean).join('\n');

  let result;
  try {
    result = await callClaude({
      system: systemPrompt,
      messages: [{ role: 'user', content: `Please summarize the current state of the ${ctx.roomName || 'room'}.` }],
      maxTokens: 600,
    });
  } catch (e) {
    return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
  }

  if (!result.text.trim()) return res.status(502).json({ error: 'AI returned an empty response.' });

  logUsage({ userId, projectId, feature: 'room-summary', inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  return res.status(200).json({ summary: result.text.trim() });
}

// ── Feature: project assistant ────────────────────────────────────────────────
function buildAssistantSystemPrompt(ctx = {}) {
  const lines = [
    'You are a helpful project assistant for a construction and restoration company.',
    'You are scoped exclusively to a single project — never reference or reveal information from other projects.',
    'Be concise, practical, and professional. Use plain language.',
    '',
    '── PROJECT CONTEXT ──────────────────────────────────────',
  ];
  if (ctx.projectTitle)       lines.push(`Project:     ${ctx.projectTitle}`);
  if (ctx.projectAddress)     lines.push(`Address:     ${ctx.projectAddress}`);
  if (ctx.projectStatus)      lines.push(`Status:      ${ctx.projectStatus}`);
  if (ctx.projectDescription) lines.push(`Description: ${ctx.projectDescription}`);
  if (ctx.taskSummary)        lines.push(`Tasks:       ${ctx.taskSummary}`);
  if (ctx.photoCount != null) lines.push(`Photos:      ${ctx.photoCount}`);
  if (ctx.reportCount != null)lines.push(`Reports:     ${ctx.reportCount}`);
  if (ctx.checklistSummary)   lines.push(`Checklists:  ${ctx.checklistSummary}`);
  if (ctx.teamSize != null)   lines.push(`Team:        ${ctx.teamSize} member(s)`);
  lines.push('─────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Important rules:');
  lines.push('- Only discuss this specific project. Politely decline questions about other projects or unrelated topics.');
  lines.push('- Do not make up information not present in the context above.');
  lines.push('- If unsure, say so and suggest what data might help.');
  lines.push('- Keep responses focused and under 300 words unless a detailed breakdown is explicitly requested.');
  return lines.join('\n');
}

async function handleAssistant(req, res, userId) {
  const { projectId, message, history = [], context = {} } = req.body || {};
  if (!projectId)      return res.status(400).json({ error: 'projectId is required' });
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const trimmedHistory = (Array.isArray(history) ? history : []).slice(-20).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));
  const messages = [
    ...trimmedHistory,
    { role: 'user', content: message.trim().slice(0, 2000) },
  ];

  let result;
  try {
    result = await callClaude({ system: buildAssistantSystemPrompt(context), messages, maxTokens: 1200 });
  } catch (e) {
    return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
  }

  if (!result.text.trim()) return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });

  // Log to project_assistant_requests (fire-and-forget)
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (serviceKey && supabaseUrl && userId && projectId) {
    fetch(`${supabaseUrl}/rest/v1/project_assistant_requests`, {
      method:  'POST',
      headers: {
        apikey:         serviceKey,
        Authorization:  `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        project_id:    projectId,
        user_id:       userId,
        prompt:        message.trim().slice(0, 4000),
        response:      result.text.trim().slice(0, 4000),
        krakens_used:  2,
        input_tokens:  result.inputTokens,
        output_tokens: result.outputTokens,
      }),
    }).catch(e => console.warn('[generate-report/assistant] Request log failed:', e.message));
  }

  logUsage({ userId, projectId, feature: 'project-assistant', inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  return res.status(200).json({ reply: result.text.trim() });
}

// ── Feature: report writer ────────────────────────────────────────────────────
async function handleReport(req, res, userId) {
  const {
    projectName        = 'Unnamed Project',
    projectDescription = '',
    photos             = [],
    customPrompt       = '',
  } = req.body || {};

  let userMessage = `Please write a professional project report for the following:\n\n`;
  userMessage    += `**Project Name:** ${projectName}\n\n`;
  if (projectDescription) userMessage += `**Project Description:**\n${projectDescription}\n\n`;
  if (photos && photos.length > 0) {
    userMessage += `**Photos / Site Observations (${photos.length} photos):**\n`;
    photos.slice(0, 20).forEach((desc, i) => {
      if (typeof desc === 'string' && desc.trim()) userMessage += `  ${i + 1}. ${desc.trim()}\n`;
    });
    userMessage += '\n';
  }
  if (customPrompt?.trim()) userMessage += `**Additional Instructions:**\n${customPrompt.trim()}\n\n`;
  userMessage +=
    'Please provide a comprehensive, professional report with:\n' +
    '- Executive Summary\n- Site Conditions\n- Findings and Observations\n- Recommendations\n- Next Steps\n';

  const REPORT_SYSTEM =
    'You are an expert construction/restoration project report writer. ' +
    'Write professional, detailed reports based on the provided project information. ' +
    'Use clear headings, bullet points where appropriate, and formal business language.';

  let result;
  try {
    result = await callClaude({ system: REPORT_SYSTEM, messages: [{ role: 'user', content: userMessage }], maxTokens: 2000 });
  } catch (e) {
    return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
  }

  if (!result.text.trim()) return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });

  logUsage({ userId, feature: 'generate-report', inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  return res.status(200).json({ report: result.text.trim() });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

  let userId = null;
  try {
    userId = await verifyToken(token);
    if (!userId) return res.status(401).json({ error: 'Invalid or expired token' });
  } catch (authErr) {
    console.warn('[generate-report] Auth check failed:', authErr.message);
  }

  const feature = req.body?.feature;
  if (feature === 'assistant')    return handleAssistant(req, res, userId);
  if (feature === 'room-summary') return handleRoomSummary(req, res, userId);
  return handleReport(req, res, userId);
}
