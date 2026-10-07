// version 1.5
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isRuntimeTraceRequest(request: string) {
  const text = request.toLowerCase();
  return /runtime\\s+trace|runtime trace|трассировк|телеметр|системн(?:ый|ые)\\s+журнал|реально\\s+выполнен|этапы\\s+реально/i.test(text);
}

function classify(request: string) {
  const text = request.toLowerCase();
  const groups: Array<[string, string[]]> = [
    ["security-expert", ["безопас", "security", "уязв", "парол", "токен", "доступ", "auth"]],
    ["developer-expert", ["код", "разработ", "архитект", "github", "supabase", "telegram", "бот", "api", "функц", "bug", "ошибк"]],
    ["ux-product-expert", ["ux", "ui", "дизайн", "интерфейс", "пользоват", "сценар", "продукт"]],
    ["financial-expert", ["финанс", "долг", "доход", "расход", "резерв", "капитал"]],
    ["historical-expert", ["истори", "источник", "архив", "дата"]],
    ["scientific-expert", ["наук", "исследован", "гипотез", "эксперимент"]],
    ["data-statistics-expert", ["статист", "данн", "метрик", "аналит", "вероятн"]],
    ["economic-expert", ["эконом", "рынок", "инфляц", "ввп", "спрос", "предлож"]],
  ];
  const selected: string[] = [];
  for (const [agent, keywords] of groups) {
    if (keywords.some((keyword) => text.includes(keyword))) selected.push(agent);
  }
  if (selected.length === 0) selected.push("developer-expert");
  return selected;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  let authorized = req.headers.get("authorization") === `Bearer ${serviceRoleKey}`;
  if (!authorized) {
    const internalToken = req.headers.get("x-ai-internal-token");
    if (internalToken) {
      const { data: internalAccess } = await supabase
        .from("runtime_internal_tokens")
        .select("key")
        .eq("key", "retry_dispatch")
        .eq("token", internalToken)
        .maybeSingle();
      authorized = Boolean(internalAccess);
    }
  }
  if (!authorized) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const taskId = body?.task_id;
  if (!taskId) return json({ ok: false, error: "task_id_required" }, 400);

  const { data: task, error: taskError } = await supabase
    .from("tasks").select("id, project_id, request, status, retry_count, max_attempts").eq("id", taskId).single();
  if (taskError || !task) return json({ ok: false, error: "task_not_found" }, 404);
  if (!["pending", "retryable"].includes(task.status)) return json({ ok: true, skipped: true, status: task.status });

  const { data: coordinator, error: coordinatorError } = await supabase
    .from("agents").select("id").eq("key", "coordinator").single();
  if (coordinatorError || !coordinator) return json({ ok: false, error: "coordinator_not_found" }, 500);

  const selected = classify(task.request);
  const agentKeys = ["coordinator", ...selected.filter((key) => key !== "coordinator")];

  const { data: agents, error: agentsError } = await supabase
    .from("agents").select("id, key").in("key", agentKeys).eq("status", "active");
  if (agentsError || !agents) return json({ ok: false, error: "agent_lookup_failed" }, 500);

  const { error: statusError } = await supabase
    .from("tasks").update({
      status: "consulting",
      failure_class: null,
      next_retry_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id).in("status", ["pending", "retryable"]);
  if (statusError) return json({ ok: false, error: "task_update_failed" }, 500);

  const { data: existing } = await supabase
    .from("task_participants").select("agent_id").eq("task_id", task.id);
  const existingIds = new Set((existing ?? []).map((row) => row.agent_id));

  const participants = agents
    .filter((agent) => !existingIds.has(agent.id))
    .map((agent) => ({
      task_id: task.id,
      agent_id: agent.id,
      participation_type: agent.key === "coordinator" ? "primary" : "consultant",
    }));

  if (participants.length > 0) {
    const { error: participantError } = await supabase
      .from("task_participants").insert(participants);
    if (participantError) {
      await supabase.from("tasks").update({ status: "blocked" }).eq("id", task.id);
      return json({ ok: false, error: "participant_assignment_failed" }, 500);
    }
  }

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "coordination_started",
    actor_type: "coordinator",
    actor_id: coordinator.id,
    payload: { classification: "keyword_router_v1", context_version: "1.4", selected_agents: agentKeys, observability_request: isRuntimeTraceRequest(task.request), runtime: "coordinator-worker_v1.5" },
  });

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "routing_completed",
    actor_type: "coordinator",
    actor_id: coordinator.id,
    payload: { runtime: "coordinator-worker_v1.5", selected_agents: agentKeys, observability_request: isRuntimeTraceRequest(task.request) },
  });

  const functionUrl = `${supabaseUrl}/functions/v1/expert-worker`;
  const dispatchResponse = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ task_id: task.id }),
  });

  if (!dispatchResponse.ok) {
    const retryCount = Number(task.retry_count || 0) + 1;
    const exhausted = retryCount >= Number(task.max_attempts || 3);
    await supabase.from("tasks").update({
      status: exhausted ? "failed" : "retryable",
      retry_count: retryCount,
      failure_class: "retryable",
      next_retry_at: exhausted ? null : new Date(Date.now() + 30000).toISOString(),
      last_error: "expert_dispatch_failed",
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);

    await supabase.from("task_events").insert({
      task_id: task.id,
      event_type: "expert_dispatch_failed",
      actor_type: "coordinator",
      actor_id: coordinator.id,
      payload: { status: dispatchResponse.status },
    });
    return json({ ok: false, error: "expert_dispatch_failed" }, 502);
  }

  return json({ ok: true, task_id: task.id, status: "consulting", selected_agents: agentKeys });
});
