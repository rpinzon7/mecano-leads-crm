import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const workspaceName = import.meta.env.VITE_CRM_WORKSPACE || "mecano-principal";

export const cloudEnabled = Boolean(url && anonKey);
export const supabase = cloudEnabled ? createClient(url, anonKey) : null;

export function getWorkspaceName() {
  return workspaceName;
}

async function ensureWorkspace() {
  if (!supabase) return null;

  const { data: existing, error: findError } = await supabase
    .from("crm_workspaces")
    .select("*")
    .eq("name", workspaceName)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("crm_workspaces")
    .insert({ name: workspaceName, leads_json: [] })
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

export async function loadWorkspaceFromCloud() {
  if (!supabase) return null;
  return await ensureWorkspace();
}

export async function saveWorkspaceToCloud(leads) {
  if (!supabase) return null;
  await ensureWorkspace();
  const { data, error } = await supabase
    .from("crm_workspaces")
    .update({ leads_json: leads, updated_at: new Date().toISOString() })
    .eq("name", workspaceName)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, fullName) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || "" } },
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
