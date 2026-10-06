// version 1.0
// Source deployed as Supabase Edge Function: telegram-webhook.
// Telegram webhook is authenticated with X-Telegram-Bot-Api-Secret-Token.
// The bot token and webhook secret must never be committed to Git.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!webhookSecret) return json({ ok: false, error: "webhook_not_configured" }, 503);

  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;

  if (!message?.text || !message?.chat?.id || !message?.from?.id) {
    return json({ ok: true, ignored: true });
  }

  const requestText = String(message.text).trim();
  if (!requestText) return json({ ok: true, ignored: true });

  const { data: project, error: projectError } = await supabase
    .from("projects").select("id").eq("key", "ai-sistem").single();

  if (projectError || !project) return json({ ok: false, error: "project_not_found" }, 500);

  const { data: coordinator, error: coordinatorError } = await supabase
    .from("agents").select("id").eq("key", "coordinator").single();

  if (coordinatorError || !coordinator) {
    return json({ ok: false, error: "coordinator_not_found" }, 500);
  }

  const title = requestText.length > 80 ? requestText.slice(0, 77) + "..." : requestText;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      project_id: project.id,
      title,
      request: requestText,
      created_by: "telegram",
      status: "pending",
    })
    .select("id")
    .single();

  if (taskError || !task) return json({ ok: false, error: "task_creation_failed" }, 500);

  const { error: participantError } = await supabase
    .from("task_participants")
    .insert({
      task_id: task.id,
      agent_id: coordinator.id,
      participation_type: "primary",
    });

  if (participantError) {
    await supabase.from("tasks").delete().eq("id", task.id);
    return json({ ok: false, error: "coordinator_assignment_failed" }, 500);
  }

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "task_created",
    actor_type: "system",
    payload: {
      channel: "telegram",
      telegram_update_id: update?.update_id ?? null,
      telegram_chat_id: String(message.chat.id),
      telegram_user_id: String(message.from.id),
    },
  });

  return json({ ok: true, task_id: task.id });
});
