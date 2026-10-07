// version 1.2

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

async function dispatchRun(runId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider-worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ run_id: runId }),
  });

  const raw = await response.text();
  return { runId, ok: response.ok, status: response.status, body: raw };
}

async function dispatchResultAggregator(taskId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/result-aggregator`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ task_id: taskId }),
  });

  const raw = await response.text();
  return { ok: response.ok, status: response.status, body: raw };
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
    .from("tasks").select("id, project_id, request, status").eq("id", taskId).single();

  if (taskError || !task) return json({ ok: false, error: "task_not_found" }, 404);
  if (task.status !== "consulting") return json({ ok: true, skipped: true, status: task.status });

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
    .from("agent_runs").select("agent_id, status").eq("task_id", task.id);

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

  let createdRuns: { id: string }[] = [];
  if (runs.length > 0) {
    const { data: insertedRuns, error: insertError } = await supabase
      .from("agent_runs").insert(runs).select("id");

    if (insertError || !insertedRuns) return json({ ok: false, error: "run_creation_failed" }, 500);
    createdRuns = insertedRuns;
  }

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "expert_consultations_queued",
    actor_type: "coordinator",
    payload: {
      runtime: "expert_worker_v1.2",
      consultants: agents.map((agent) => agent.key),
      queued_count: createdRuns.length,
    },
  });

  const dispatchResults = await Promise.all(createdRuns.map((run) => dispatchRun(run.id)));
  const failedDispatches = dispatchResults.filter((result) => !result.ok);

  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: "expert_consultations_dispatched",
    actor_type: "coordinator",
    payload: {
      runtime: "expert_worker_v1.2",
      dispatched_count: dispatchResults.length - failedDispatches.length,
      failed_count: failedDispatches.length,
      results: dispatchResults.map((result) => ({
        run_id: result.runId,
        ok: result.ok,
        status: result.status,
      })),
    },
  });

  if (failedDispatches.length > 0) {
    return json({
      ok: false,
      task_id: task.id,
      status: "consulting",
      queued_runs: createdRuns.length,
      dispatched_runs: dispatchResults.length - failedDispatches.length,
      failed_dispatches: failedDispatches.length,
      consultants: agents.map((agent) => agent.key),
    }, 502);
  }

  const { data: consultantRuns, error: consultantRunsError } = await supabase
    .from("agent_runs")
    .select("id, agent_id, status")
    .eq("task_id", task.id)
    .in("agent_id", consultantIds);

  if (consultantRunsError) return json({ ok: false, error: "consultant_status_lookup_failed" }, 500);

  const allCompleted = (consultantRuns ?? []).length === consultantIds.length &&
    (consultantRuns ?? []).every((run) => run.status === "completed");

  if (!allCompleted) {
    return json({
      ok: true,
      task_id: task.id,
      status: "consulting",
      queued_runs: createdRuns.length,
      dispatched_runs: dispatchResults.length,
      finalization: "waiting",
    });
  }

  const finalization = await dispatchResultAggregator(task.id);
  await supabase.from("task_events").insert({
    task_id: task.id,
    event_type: finalization.ok ? "result_aggregation_dispatched" : "result_aggregation_failed",
    actor_type: "coordinator",
    payload: {
      runtime: "result_aggregator_v1.0",
      status: finalization.status,
    },
  });

  return json({
    ok: finalization.ok,
    task_id: task.id,
    status: finalization.ok ? "completed" : "consulting",
    queued_runs: createdRuns.length,
    dispatched_runs: dispatchResults.length,
    finalization: finalization.ok ? "completed" : "failed",
  }, finalization.ok ? 200 : 502);
});
