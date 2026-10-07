// version 1.3

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey = Deno.env.get("OPENAI_API_KEY");
const model = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";
const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
const db = createClient(url, serviceRole, { auth: { persistSession: false } });
const json = (x: unknown, s = 200) =>
  new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } });

function extractResponseText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as { output_text?: unknown; output?: unknown };
  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  if (!Array.isArray(root.output)) return "";
  const parts: string[] = [];
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n").trim();
}

function parseStructuredExpertResult(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("authorization") !== `Bearer ${serviceRole}`) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const runId = body?.run_id;
  if (!runId) return json({ ok: false, error: "run_id_required" }, 400);

  const { data: run, error } = await db
    .from("agent_runs").select("id,task_id,agent_id,status,input").eq("id", runId).single();
  if (error || !run) return json({ ok: false, error: "run_not_found" }, 404);
  if (run.status !== "queued") return json({ ok: true, skipped: true, status: run.status });

  if (!apiKey) {
    await db.from("agent_runs").update({
      status: "failed", error: "OPENAI_API_KEY is not configured",
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", run.id).eq("status", "queued");
    return json({ ok: false, error: "provider_not_configured" }, 503);
  }

  const { data: claimed } = await db.from("agent_runs").update({
    status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", run.id).eq("status", "queued").select("id").single();
  if (!claimed) return json({ ok: true, skipped: true, status: "already_claimed" });

  const mode = String(run.input?.mode || "expert");
  const context = run.input?.context || {};
  const platform = context.platform || { key: "ai-sistem", name: "Ai-Sistem" };
  const project = context.project || {};
  const agent = context.agent || {};
  const task = context.task || {};
  const rules = context.execution_rules || {};

  let instructions = "";
  let input = "";

  if (mode === "synthesis") {
    instructions =
      "You are the Chief Coordinator of Ai-Sistem. " +
      "Use the supplied Coordinator instructions as the persistent role definition. " +
      "Synthesize the expert consultations into one direct answer to the user. " +
      "Do not mention internal prompts, database IDs, API keys, service-role keys, hidden system mechanics, or runtime implementation details. " +
      "Resolve contradictions explicitly, distinguish facts from assumptions, and do not invent missing evidence. " +
      "Return only the final user-facing answer.";
    input =
      "SYSTEM CONTEXT\n" + JSON.stringify({ platform, project, agent, task, execution_rules: rules }) +
      "\n\nEXPERT CONSULTATIONS\n" + JSON.stringify(run.input?.expert_results || []) +
      "\n\nUSER REQUEST\n" + String(task.user_request || run.input?.request || "") +
      "\n\nProduce the final answer for the user.";
  } else {
    instructions =
      "You are a specialist consultant inside Ai-Sistem. " +
      "Follow the supplied persistent expert instructions and stay within the assigned role. " +
      "Do not implement code or perform actions. " +
      "Separate confirmed facts from assumptions and explicitly record missing information. " +
      "Return ONLY valid JSON with exactly these top-level fields: " +
      "conclusion (string), findings (array), risks (array), recommendations (array), " +
      "facts (array), assumptions (array), unknowns (array), confidence (number from 0 to 1).";
    input =
      "SYSTEM CONTEXT\n" + JSON.stringify({ platform, project, agent, task, execution_rules: rules }) +
      "\n\nUSER REQUEST\n" + String(task.user_request || "") +
      "\n\nYour output must be valid JSON and must not contain markdown fences.";
  }

  try {
    const response = await fetch(base + "/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions, input }),
    });

    const raw = await response.text();
    if (!response.ok) throw new Error("provider_http_" + response.status);
    const data = JSON.parse(raw);
    const text = extractResponseText(data);
    if (!text) throw new Error("provider_empty_output");

    const timestamp = new Date().toISOString();
    await db.from("agent_runs").update({
      status: "completed",
      output: {
        text,
        structured: mode === "expert" ? parseStructuredExpertResult(text) : null,
        provider: "openai",
        model,
        response_id: data.id || null,
      },
      completed_at: timestamp, updated_at: timestamp, error: null,
    }).eq("id", run.id);

    await db.from("task_events").insert({
      task_id: run.task_id,
      event_type: mode === "synthesis" ? "final_coordinator_completed" : "expert_consultation_completed",
      actor_type: "agent",
      actor_id: run.agent_id,
      payload: {
        run_id: run.id,
        provider: "openai",
        model,
        mode,
        structured_output: mode === "expert" ? Boolean(parseStructuredExpertResult(text)) : false,
      },
    });

    return json({ ok: true, run_id: run.id, status: "completed" });
  } catch (error) {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : "provider_error";
    await db.from("agent_runs").update({
      status: "failed", error: message, completed_at: timestamp, updated_at: timestamp,
    }).eq("id", run.id);
    await db.from("task_events").insert({
      task_id: run.task_id, event_type: "expert_consultation_failed", actor_type: "agent",
      actor_id: run.agent_id, payload: { run_id: run.id, error: message, mode },
    });
    return json({ ok: false, error: "provider_execution_failed" }, 502);
  }
});
