// version 1.0

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const taskId = body?.task_id;
  if (!taskId) return json({ ok: false, error: "task_id_required" }, 400);

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, project_id, request, status")
    .eq("id", taskId)
    .single();

  if (taskError || !task) return json({ ok: false, error: "task_not_found" }, 404);
  if (task.status !== "consulting") {
    return json({ ok: true, skipped: true, status: task.status });
  }

  const { data: participants, error: participantsError } = await supabase
    .from("task_participants")
    .select("agent_id, participation_type")
    .eq("task_id", task.id)
    .eq("participation_type", "consultant");

  if (participantsError) return json({ ok: false, error: "participant_lookup_failed" }, 500);

  const consultantIds = (participants ?? []).map((p) => p.agent_id);
  if (consultantIds.length === 0) return json({ ok: false, error: "no_consultants_assigned" }, 409);

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, key, role, instruction_file")
    .in("id", consultantIds)
    .eq("status", "active");

  if (agentsError || !agents) return json({ ok: false, error: "agent_lookup_failed" }, 500);

  const { data: existing, error: existingError } = await supabase
    .from("agent_runs")
    .select("agent_id, status")
    .eq("task_id", task.id);

  if (existingError) return json({ ok: false, error: "run_lookup_failed" }, 500);

  const existingIds = new Set((existing ?? []).map((r) => r.agent_id));
  const runs = agents
    .filter((agent) => !existingIds.has(agent.id))
    .map((agent) => ({
      task_id: task.id,
      agent_id: agent.id,
      status: "queued",
      input: {
        request: task.request,
        project_id: task.project_id,
        agent_key: agent.key,
        role: agent.role,
        instruction_file: agent.instruction_file,
      },
    }));

  if (runs.length > 0) {
    const { error: insertError } = await supabase.from("agent_runs").insert(runs);
    if (insertError) return json({ ok: false, error: "run_creation_failed" }, 500);
  }

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "expert_consultations_queued",
    actor_type: "coordinator",
    payload: {
      runtime: "expert_worker_v1",
      consultants: agents.map((agent) => agent.key),
      queued_count: runs.length,
    },
  });

  return json({
    ok: true,
    task_id: task.id,
    status: "consulting",
    queued_runs: runs.length,
    consultants: agents.map((agent) => agent.key),
  });
});
