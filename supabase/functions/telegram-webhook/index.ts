// version 1.2
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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

  const text = String(message.text).trim();
  if (!text) return json({ ok: true, ignored: true });

  const telegramUpdateId = Number(update?.update_id);
  const telegramUserId = String(message.from.id);
  const telegramChatId = String(message.chat.id);

  if (!Number.isSafeInteger(telegramUpdateId)) {
    return json({ ok: false, error: "update_id_required" }, 400);
  }

  const { data: access, error: accessError } = await supabase
    .from("telegram_access")
    .select("id, role, status")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "active")
    .maybeSingle();

  if (accessError) return json({ ok: false, error: "access_lookup_failed" }, 500);
  if (!access) {
    return json({ ok: false, error: "access_denied" }, 403);
  }

  const { data: existingUpdate } = await supabase
    .from("telegram_updates")
    .select("task_id")
    .eq("telegram_update_id", telegramUpdateId)
    .maybeSingle();

  if (existingUpdate) {
    return json({ ok: true, duplicate: true, task_id: existingUpdate.task_id });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects").select("id").eq("key", "ai-sistem").single();
  if (projectError || !project) return json({ ok: false, error: "project_not_found" }, 500);

  const { data: coordinator, error: coordinatorError } = await supabase
    .from("agents").select("id").eq("key", "coordinator").single();
  if (coordinatorError || !coordinator) return json({ ok: false, error: "coordinator_not_found" }, 500);

  const title = text.length > 80 ? text.slice(0, 77) + "..." : text;
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({ project_id: project.id, title, request: text, created_by: "telegram", status: "pending" })
    .select("id").single();

  if (taskError || !task) return json({ ok: false, error: "task_creation_failed" }, 500);

  const { error: updateInsertError } = await supabase
    .from("telegram_updates")
    .insert({
      telegram_update_id: telegramUpdateId,
      telegram_user_id: telegramUserId,
      chat_id: telegramChatId,
      task_id: task.id,
    });

  if (updateInsertError) {
    const { data: racedUpdate } = await supabase
      .from("telegram_updates")
      .select("task_id")
      .eq("telegram_update_id", telegramUpdateId)
      .maybeSingle();

    if (racedUpdate?.task_id) {
      await supabase.from("tasks").delete().eq("id", task.id);
      return json({ ok: true, duplicate: true, task_id: racedUpdate.task_id });
    }

    await supabase.from("tasks").delete().eq("id", task.id);
    return json({ ok: false, error: "update_registration_failed" }, 500);
  }

  const { error: participantError } = await supabase
    .from("task_participants")
    .insert({ task_id: task.id, agent_id: coordinator.id, participation_type: "primary" });
  if (participantError) {
    await supabase.from("tasks").delete().eq("id", task.id);
    return json({ ok: false, error: "coordinator_assignment_failed" }, 500);
  }

  await supabase.from("task_events").insert({
    task_id: task.id, event_type: "task_created", actor_type: "system",
    payload: {
      channel: "telegram",
      telegram_update_id: telegramUpdateId,
      telegram_chat_id: telegramChatId,
      telegram_user_id: telegramUserId,
      access_role: access.role,
    },
  });

  const response = await fetch(`${supabaseUrl}/functions/v1/coordinator-worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ task_id: task.id }),
  });

  if (!response.ok) {
    await supabase.from("task_events").insert({
      task_id: task.id, event_type: "coordination_dispatch_failed", actor_type: "system",
      payload: { status: response.status },
    });
  }

  return json({ ok: true, task_id: task.id });
});
