// version 1.0
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey=Deno.env.get("OPENAI_API_KEY");
const model=Deno.env.get("OPENAI_MODEL")||"gpt-6-luna";
const base=Deno.env.get("OPENAI_BASE_URL")||"https://api.openai.com/v1";
const db=createClient(url,serviceRole,{auth:{persistSession:false}});
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  if(req.headers.get("authorization")!==`Bearer ${serviceRole}`)return json({ok:false,error:"unauthorized"},401);
  const body=await req.json().catch(()=>null),runId=body?.run_id;
  if(!runId)return json({ok:false,error:"run_id_required"},400);
  const {data:run,error}=await db.from("agent_runs").select("id,task_id,agent_id,status,input").eq("id",runId).single();
  if(error||!run)return json({ok:false,error:"run_not_found"},404);
  if(run.status!=="queued")return json({ok:true,skipped:true,status:run.status});
  if(!apiKey){
    await db.from("agent_runs").update({status:"failed",error:"OPENAI_API_KEY is not configured",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",run.id).eq("status","queued");
    return json({ok:false,error:"provider_not_configured"},503);
  }
  const {data:claimed}=await db.from("agent_runs").update({status:"running",started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",run.id).eq("status","queued").select("id").single();
  if(!claimed)return json({ok:true,skipped:true,status:"already_claimed"});
  const {data:agent}=await db.from("agents").select("name,role").eq("id",run.agent_id).single();
  const input="Expert role: "+String(agent?.role||"expert")+"\nRequest: "+String(run.input?.request||"")+"\nProvide: conclusion, findings, risks, recommendation, confidence, evidence/assumptions.";
  try{
    const r=await fetch(base+"/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,instructions:"You are an expert consultant inside Ai-Sistem. Do not implement code. Be precise and explicitly mark uncertainty.",input})});
    const raw=await r.text();if(!r.ok)throw new Error("provider_http_"+r.status);
    const data=JSON.parse(raw),text=data.output_text||"";
    if(!text)throw new Error("provider_empty_output");
    const t=new Date().toISOString();
    await db.from("agent_runs").update({status:"completed",output:{text,provider:"openai",model,response_id:data.id||null},completed_at:t,updated_at:t,error:null}).eq("id",run.id);
    await db.from("task_events").insert({task_id:run.task_id,event_type:"expert_consultation_completed",actor_type:"agent",actor_id:run.agent_id,payload:{run_id:run.id,provider:"openai",model}});
    return json({ok:true,run_id:run.id,status:"completed"});
  }catch(e){
    const t=new Date().toISOString(),msg=e instanceof Error?e.message:"provider_error";
    await db.from("agent_runs").update({status:"failed",error:msg,completed_at:t,updated_at:t}).eq("id",run.id);
    await db.from("task_events").insert({task_id:run.task_id,event_type:"expert_consultation_failed",actor_type:"agent",actor_id:run.agent_id,payload:{run_id:run.id,error:msg}});
    return json({ok:false,error:"provider_execution_failed"},502);
  }
});