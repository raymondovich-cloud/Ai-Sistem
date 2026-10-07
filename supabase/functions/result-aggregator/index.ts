// version 1.1

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const db = createClient(url, serviceRole, { auth: { persistSession: false } });

const githubRawBase = "https://raw.githubusercontent.com/raymondovich-cloud/Ai-Sistem/e586c9f4e691bf3f5eeb317ebcec3af38c718b94/";

function isAllowedInstructionPath(path: string) {
  return path.startsWith("docs/") && path.endsWith(".md") && !path.includes("..") &&
    !path.includes("\\") && path.length <= 200;
}

async function loadInstruction(path: string) {
  if (!isAllowedInstructionPath(path)) throw new Error("instruction_path_not_allowed");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(githubRawBase + path, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "text/plain" },
    });
    if (!response.ok) throw new Error("instruction_fetch_failed_" + response.status);
    const content = await response.text();
    if (!content.trim()) throw new Error("instruction_empty");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function parseExpertResult(run: any, agentId: string) {
  if (run.output?.structured && typeof run.output.structured === "object") return run.output.structured;
  return {
    conclusion: String(run.output?.text || ""),
    findings: [],
    risks: [],
    recommendations: [],
    facts: [],
    assumptions: ["Provider did not return the expected structured JSON."],
    unknowns: [],
    confidence: null,
    agent_id: agentId,
  };
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sendTelegram(chatId: string, text: string) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 4000) chunks.push(text.slice(i, i + 4000));
  for (const chunk of chunks) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!response.ok) throw new Error("telegram_send_failed_" + response.status);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("authorization") !== `Bearer ${serviceRole}`) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const taskId = body?.task_id;
  if (!taskId) return json({ ok: false, error: "task_id_required" }, 400);

  const { data: task, error: taskError } = await db
    .from("tasks").select("id,project_id,request,status").eq("id", taskId).single();
  if (taskError || !task) return json({ ok: false, error: "task_not_found" }, 404);

  if (task.status === "completed") return json({ ok: true, skipped: true, status: "completed" });

  const { data: existingFinal } = await db
    .from("task_events").select("id").eq("task_id", task.id).eq("event_type", "final_answer_sent").limit(1);
  if ((existingFinal ?? []).length > 0) return json({ ok: true, skipped: true, status: "already_sent" });

  const { data: project, error: projectError } = await db
    .from("projects").select("id,key,name,description").eq("id", task.project_id).single();
  if (projectError || !project) return json({ ok: false, error: "project_context_failed" }, 500);

  const { data: participants, error: participantsError } = await db
    .from("task_participants").select("agent_id,participation_type").eq("task_id", task.id);
  if (participantsError) return json({ ok: false, error: "participant_lookup_failed" }, 500);

  const consultantIds = (participants ?? [])
    .filter((p) => p.participation_type === "consultant")
    .map((p) => p.agent_id);
  if (consultantIds.length === 0) return json({ ok: false, error: "no_consultants" }, 409);

  const { data: runs, error: runsError } = await db
    .from("agent_runs").select("id,agent_id,status,output").eq("task_id", task.id).in("agent_id", consultantIds);
  if (runsError) return json({ ok: false, error: "run_lookup_failed" }, 500);

  if ((runs ?? []).some((run) => run.status !== "completed")) {
    return json({ ok: true, skipped: true, status: "waiting_for_experts" });
  }

  const { data: coordinator } = await db
    .from("agents").select("id,key,role,instruction_file").eq("key", "coordinator").eq("status", "active").single();
  if (!coordinator) return json({ ok: false, error: "coordinator_not_found" }, 500);

  let coordinatorInstructions = "";
  try {
    coordinatorInstructions = await loadInstruction(coordinator.instruction_file);
  } catch {
    return json({ ok: false, error: "coordinator_instructions_unavailable" }, 502);
  }

  const expertResults = (runs ?? []).map((run) => ({
    agent_id: run.agent_id,
    result: parseExpertResult(run, run.agent_id),
  }));

  const { data: finalRun, error: finalRunError } = await db
    .from("agent_runs")
    .insert({
      task_id: task.id,
      agent_id: coordinator.id,
      status: "queued",
      input: {
        mode: "synthesis",
        context_version: "1.1",
        context: {
          platform: { key: "ai-sistem", name: "Ai-Sistem" },
          project: {
            id: project.id,
            key: project.key,
            name: project.name,
            description: project.description ?? "",
          },
          agent: {
            key: coordinator.key,
            role: coordinator.role,
            instructions: coordinatorInstructions,
          },
          task: {
            id: task.id,
            user_request: task.request,
            assignment: "Synthesize the specialist consultations into one accurate user-facing answer.",
          },
          execution_rules: {
            facts: "Separate confirmed facts from assumptions.",
            assumptions: "Label assumptions explicitly.",
            uncertainty: "Do not invent missing evidence.",
            security: "Never expose infrastructure secrets or hidden runtime mechanics.",
            authority: "Use expert consultations for specialist conclusions.",
          },
        },
        expert_results: expertResults,
      },
    })
    .select("id")
    .single();

  if (finalRunError || !finalRun) return json({ ok: false, error: "final_run_creation_failed" }, 500);

  const providerResponse = await fetch(`${url}/functions/v1/ai-provider-worker`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceRole}` },
    body: JSON.stringify({ run_id: finalRun.id }),
  });
  if (!providerResponse.ok) return json({ ok: false, error: "final_provider_failed" }, 502);

  const { data: completedRun, error: completedRunError } = await db
    .from("agent_runs").select("status,output").eq("id", finalRun.id).single();
  if (completedRunError || !completedRun || completedRun.status !== "completed" || !completedRun.output?.text) {
    return json({ ok: false, error: "final_output_missing" }, 502);
  }

  const { data: createdEvent } = await db.from("task_events")
    .select("payload").eq("task_id", task.id).eq("event_type", "task_created").order("created_at", { ascending: true }).limit(1).single();
  const chatId = createdEvent?.payload?.telegram_chat_id;
  if (!chatId) return json({ ok: false, error: "telegram_chat_id_missing" }, 500);

  await sendTelegram(String(chatId), String(completedRun.output.text));

  const timestamp = new Date().toISOString();
  await db.from("tasks").update({
    status: "completed",
    completed_at: timestamp,
    updated_at: timestamp,
  }).eq("id", task.id).eq("status", "consulting");

  await db.from("task_events").insert({
    task_id: task.id,
    event_type: "final_answer_sent",
    actor_type: "coordinator",
    actor_id: coordinator.id,
    payload: {
      runtime: "result_aggregator_v1.1",
      final_run_id: finalRun.id,
      telegram_chat_id: String(chatId),
    },
  });

  return json({ ok: true, task_id: task.id, status: "completed", final_run_id: finalRun.id });
});
