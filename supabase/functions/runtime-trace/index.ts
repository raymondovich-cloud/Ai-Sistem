// version 1.1

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("authorization") !== `Bearer ${serviceRole}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const taskId = body?.task_id;
  if (typeof taskId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    return json({ ok: false, error: "valid_task_id_required" }, 400);
  }

  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };
  const base = `${supabaseUrl}/rest/v1`;

  const fetchJson = async (path: string) => {
    const response = await fetch(`${base}/${path}`, { headers });
    if (!response.ok) throw new Error(`runtime_trace_query_failed_${response.status}`);
    return response.json();
  };

  try {
    const [tasks, events, runs, finalizations, components, updates] = await Promise.all([
      fetchJson(`tasks?select=id,status,retry_count,max_attempts,failure_class,next_retry_at,last_error,created_at,updated_at,completed_at&id=eq.${taskId}`),
      fetchJson(`task_events?select=event_type,actor_type,created_at,payload&task_id=eq.${taskId}&order=created_at.asc`),
      fetchJson(`agent_runs?select=agent_id,status,attempt,started_at,completed_at&task_id=eq.${taskId}&order=attempt.asc`),
      fetchJson(`task_finalizations?select=status,claimed_at,sent_at,failed_at,attempt_count,telegram_message_ids,telegram_api_confirmed,delivery_error&task_id=eq.${taskId}`),
      fetchJson(`runtime_component_versions?select=component_key,runtime_version,edge_version,status,updated_at&status=eq.active&order=component_key.asc`),
      fetchJson(`telegram_updates?select=telegram_update_id,received_at&task_id=eq.${taskId}&order=received_at.asc`),
    ]);

    if (!tasks[0]) return json({ ok: false, error: "task_not_found" }, 404);

    const agentIds = [...new Set((runs ?? []).map((run: any) => run.agent_id).filter(Boolean))];
    let agents: any[] = [];
    if (agentIds.length) {
      const encoded = agentIds.map((id: string) => `"${id}"`).join(",");
      agents = await fetchJson(`agents?select=id,key&id=in.(${encoded})`);
    }
    const agentKeys = new Map(agents.map((agent: any) => [agent.id, agent.key]));

    return json({
      ok: true,
      trace: {
        mode: "runtime_trace",
        authoritative: true,
        source: "supabase_runtime",
        task: tasks[0],
        stages: (events ?? []).map((event: any) => ({
          event_type: event.event_type,
          actor_type: event.actor_type,
          created_at: event.created_at,
          runtime: event.payload?.runtime ?? null,
          status: event.payload?.status ?? null,
        })),
        runs: (runs ?? []).map((run: any) => ({
          agent: agentKeys.get(run.agent_id) ?? "unknown",
          status: run.status,
          attempt: run.attempt ?? 1,
          started_at: run.started_at ?? null,
          completed_at: run.completed_at ?? null,
        })),
        delivery: finalizations[0] ?? null,
        telegram: {
          updates_received: (updates ?? []).length,
          update_ids: (updates ?? []).map((u: any) => u.telegram_update_id),
        },
        runtime_components: components ?? [],
        policy: "Only confirmed Supabase runtime records are authoritative. Code documentation and expert output are not execution evidence.",
      },
    });
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "runtime_trace_failed",
    }, 500);
  }
});
