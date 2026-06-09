export default {
  async fetch(request, env) {
    const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const origin = request.headers.get('Origin') || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-portfolio-key',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Only POST is allowed.' }, 405, corsHeaders);
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' }, 500, corsHeaders);
    }

    if (env.APP_SHARED_SECRET) {
      const provided = request.headers.get('x-portfolio-key') || '';
      if (provided !== env.APP_SHARED_SECRET) {
        return json({ ok: false, error: 'Unauthorized request.' }, 401, corsHeaders);
      }
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400, corsHeaders);
    }

    const allowedChatIds = new Set(
      String(env.ALLOWED_CHAT_IDS || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    );

    if (!allowedChatIds.size) {
      return json({ ok: false, error: 'ALLOWED_CHAT_IDS is empty.' }, 500, corsHeaders);
    }

    const requestedChatIds = Array.isArray(payload.chatIds)
      ? payload.chatIds.map(String).map(item => item.trim()).filter(Boolean)
      : [String(payload.chatId || '').trim()].filter(Boolean);

    if (!requestedChatIds.length) {
      return json({ ok: false, error: 'No chat id was provided.' }, 400, corsHeaders);
    }

    const invalidChatIds = requestedChatIds.filter(id => !allowedChatIds.has(id));
    if (invalidChatIds.length) {
      return json({ ok: false, error: `Chat ID is not allowed: ${invalidChatIds.join(', ')}` }, 403, corsHeaders);
    }

    const text = buildMessage(payload);
    const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const results = [];

    for (const chatId of requestedChatIds) {
      const tgResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      const tgResult = await tgResponse.json().catch(() => ({}));
      results.push({ chatId, ok: tgResponse.ok && tgResult.ok !== false, telegram: tgResult });
    }

    const ok = results.every(item => item.ok);
    return json({ ok, results }, ok ? 200 : 502, corsHeaders);
  }
};

function buildMessage(payload) {
  const title = esc(payload.title || 'تسک جدید');
  const owner = esc(payload.owner || 'ثبت نشده');
  const deadline = esc(payload.deadline || 'ثبت نشده');
  const priority = esc(payload.priority || 'ثبت نشده');
  const lane = esc(payload.lane || 'ثبت نشده');
  const meetingStatus = esc(payload.meetingStatus || 'ثبت نشده');
  const deliverable = esc(payload.deliverable || 'ثبت نشده');
  const nextAction = esc(payload.nextAction || 'ثبت نشده');
  const note = esc(payload.note || '');
  const appUrl = esc(payload.appUrl || '');

  return [
    '📌 <b>اعلان داشبورد پورتفولیوی رباتیک</b>',
    '',
    `🔹 <b>عنوان:</b> ${title}`,
    `👤 <b>مسئول / پیگیر:</b> ${owner}`,
    `⏰ <b>ددلاین:</b> ${deadline}`,
    `⚠️ <b>اولویت:</b> ${priority}`,
    `📍 <b>وضعیت کاری:</b> ${lane}`,
    `🧭 <b>وضعیت جلسه:</b> ${meetingStatus}`,
    '',
    `🎯 <b>خروجی قابل تحویل:</b> ${deliverable}`,
    `✅ <b>اقدام بعدی:</b> ${nextAction}`,
    note ? `📝 <b>یادداشت:</b> ${note}` : '',
    appUrl ? `🔗 <b>لینک داشبورد:</b> ${appUrl}` : '',
  ].filter(Boolean).join('\n');
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[ch]));
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}
