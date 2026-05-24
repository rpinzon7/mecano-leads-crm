import { cloudEnabled, supabase } from "./supabase";

const TASKS_TABLE = "crm_tasks";

export const TASK_TYPES = [
  "Llamar cliente",
  "Enviar cotización",
  "Hacer seguimiento",
  "Agendar reunión",
  "Solicitar precio a proveedor",
  "Preparar presupuesto",
  "Confirmar decisión del cliente",
  "Otro",
];

export const TASK_STATUSES = ["Pendiente", "En proceso", "Completada", "Cancelada"];
export const TASK_PRIORITIES = ["Baja", "Media", "Alta", "Urgente"];

function requireCloud() {
  if (!cloudEnabled || !supabase) {
    throw new Error("Supabase no está configurado. El módulo de tareas requiere modo nube.");
  }
}

export function emptyTaskDraft(userId = "", lead = null, taskList = "Pendientes") {
  return {
    title: lead?.proximaTarea || "",
    description: "",
    task_type: "Hacer seguimiento",
    status: "Pendiente",
    priority: "Media",
    due_date: lead?.fechaSeguimiento || "",
    due_time: "",
    lead_id: lead?.id ? String(lead.id) : "",
    assigned_to: userId || "",
    task_list: taskList || "Pendientes",
  };
}

export async function loadMyTasks(userId) {
  requireCloud();
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TASKS_TABLE)
    .select("*")
    .eq("assigned_to", userId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createTask(task, userId) {
  requireCloud();
  const payload = {
    title: String(task.title || "").trim(),
    description: task.description || null,
    task_type: task.task_type || "Hacer seguimiento",
    status: task.status || "Pendiente",
    priority: task.priority || "Media",
    task_list: task.task_list || "Pendientes",
    due_date: task.due_date || null,
    due_time: task.due_time || null,
    lead_id: task.lead_id ? String(task.lead_id) : null,
    assigned_to: task.assigned_to || userId,
    created_by: userId || null,
  };
  if (!payload.title) throw new Error("La tarea necesita un título.");
  if (!payload.assigned_to) throw new Error("La tarea necesita un responsable.");

  const { data, error } = await supabase.from(TASKS_TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId, patch) {
  requireCloud();
  const payload = { ...patch, updated_at: new Date().toISOString() };
  if (payload.due_date === "") payload.due_date = null;
  if (payload.due_time === "") payload.due_time = null;
  if (payload.lead_id === "") payload.lead_id = null;
  if (payload.task_list === "") payload.task_list = "Pendientes";
  const { data, error } = await supabase.from(TASKS_TABLE).update(payload).eq("id", taskId).select().single();
  if (error) throw error;
  return data;
}

export async function completeTask(taskId) {
  return updateTask(taskId, { status: "Completada", completed_at: new Date().toISOString() });
}

export async function deleteTask(taskId) {
  requireCloud();
  const { error } = await supabase.from(TASKS_TABLE).delete().eq("id", taskId);
  if (error) throw error;
}
