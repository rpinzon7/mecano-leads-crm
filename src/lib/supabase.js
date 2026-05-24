import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const workspaceName = import.meta.env.VITE_CRM_WORKSPACE || "mecano-principal";

export const cloudEnabled = Boolean(url && anonKey);
export const supabase = cloudEnabled ? createClient(url, anonKey) : null;

const HISTORY_TABLE = "crm_lead_history";
const TRACKED_HISTORY_FIELDS = [
  { key: "estado", label: "Estado", type: "string" },
  { key: "valor", label: "Valor", type: "number" },
  { key: "fechaSeguimiento", label: "Fecha seguimiento", type: "date" },
  { key: "proximaTarea", label: "Próxima tarea", type: "string" },
  { key: "assignedTo", label: "Vendedor asignado", type: "string" },
  { key: "responsableInicial", label: "Responsable inicial", type: "string" },
  { key: "empresa", label: "Empresa", type: "string" },
  { key: "proveedor", label: "Proveedor", type: "string" },
  { key: "notas", label: "Notas", type: "string" },
  { key: "propuestaEstado", label: "Estado propuesta", type: "string" },
  { key: "cotizacionOdoo", label: "Cotización Odoo", type: "string" },
];

function normalizeHistoryValue(value, type = "string") {
  if (value === undefined || value === null) return null;
  if (type === "number") {
    if (value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : null;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function buildLeadHistoryRows(previousLeads = [], nextLeads = [], changedBy = null) {
  const previousMap = new Map(previousLeads.map((lead) => [String(lead.id), lead]));
  const now = new Date().toISOString();
  const rows = [];

  for (const nextLead of nextLeads) {
    const previousLead = previousMap.get(String(nextLead.id));
    if (!previousLead) continue;

    for (const field of TRACKED_HISTORY_FIELDS) {
      const oldValue = normalizeHistoryValue(previousLead[field.key], field.type);
      const newValue = normalizeHistoryValue(nextLead[field.key], field.type);
      if (oldValue === newValue) continue;

      rows.push({
        lead_id: String(nextLead.id),
        field_name: field.key,
        field_label: field.label,
        old_value: oldValue,
        new_value: newValue,
        changed_at: now,
        changed_by: changedBy,
        change_type: field.key === "estado" ? "status_change" : "update",
      });
    }
  }

  return rows;
}

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

export async function loadLeadHistoryFromCloud(leadId, limit = 25) {
  if (!supabase || !leadId) return [];

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select("*")
    .eq("lead_id", String(leadId))
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("No pude cargar historial del lead", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function saveWorkspaceToCloud(leads, changedBy = null) {
  if (!supabase) return null;
  const workspace = await ensureWorkspace();
  const previousLeads = Array.isArray(workspace?.leads_json) ? workspace.leads_json : [];
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_workspaces")
    .update({ leads_json: leads, updated_at: timestamp })
    .eq("name", workspaceName)
    .select()
    .single();

  if (error) throw error;

  const historyRows = buildLeadHistoryRows(previousLeads, leads, changedBy);
  if (historyRows.length) {
    const { error: historyError } = await supabase.from(HISTORY_TABLE).insert(historyRows);
    if (historyError) {
      console.error("No pude guardar historial de cambios", historyError);
    }
  }

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
