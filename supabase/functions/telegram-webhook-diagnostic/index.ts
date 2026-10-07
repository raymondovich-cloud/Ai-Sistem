// version 1.2
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function telegram(method: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`);
  return { response, payload: await response.json().catch(() => null) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const internalToken = req.headers.get("x-ai-internal-token");
  if (!internalToken) return json({ ok: false, error: "unauthorized" }, 401);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("runtime_internal_tokens")
    .select("token")
    .eq("key", "telegram_diagnostic")
    .maybeSingle();

  if (tokenError || !tokenRow || internalToken !== tokenRow.token) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!botToken) return json({ ok: false, error: "telegram_bot_not_configured" }, 503);

  const [webhook, me] = await Promise.all([telegram("getWebhookInfo"), telegram("getMe")]);
  if (!webhook.response.ok || webhook.payload?.ok !== true ||
      !me.response.ok || me.payload?.ok !== true) {
    return json({
      ok: false,
      error: "telegram_api_error",
      webhook_http_status: webhook.response.status,
      me_http_status: me.response.status,
      webhook_error: webhook.payload?.description ?? null,
      me_error: me.payload?.description ?? null,
    }, 502);
  }

  const info = webhook.payload.result ?? {};
  const bot = me.payload.result ?? {};

  return json({
    ok: true,
    diagnostic: {
      webhook: {
        url: info.url ?? "",
        has_custom_certificate: info.has_custom_certificate ?? false,
        pending_update_count: info.pending_update_count ?? 0,
        ip_address: info.ip_address ?? null,
        last_error_date: info.last_error_date ?? null,
        last_error_message: info.last_error_message ?? null,
        last_synchronization_error_date: info.last_synchronization_error_date ?? null,
        max_connections: info.max_connections ?? null,
        allowed_updates: info.allowed_updates ?? null,
      },
      bot: {
        id: bot.id ?? null,
        is_bot: bot.is_bot ?? null,
        can_join_groups: bot.can_join_groups ?? null,
        can_read_all_group_messages: bot.can_read_all_group_messages ?? null,
        supports_inline_queries: bot.supports_inline_queries ?? null,
      },
    },
  });
});
