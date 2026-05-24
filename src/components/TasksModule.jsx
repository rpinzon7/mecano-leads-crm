import React, { useEffect, useMemo, useState } from "react";
import { cloudEnabled } from "../lib/supabase";
import { completeTask, createTask, deleteTask, emptyTaskDraft, loadMyTasks, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, updateTask } from "../lib/tasksService";

const DEFAULT_TASK_LISTS = ["Pendientes", "Seguimientos", "Cotizaciones", "Proveedores", "Administrativo"];
function todayString(){const d=new Date();const tzOffset=d.getTimezoneOffset()*60000;return new Date(d.getTime()-tzOffset).toISOString().slice(0,10)}
function formatDate(value){if(!value)return "Sin fecha";const d=new Date(`${value}T00:00:00`);if(Number.isNaN(d.getTime()))return value;return d.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}
function taskBucket(task){if(task.status==="Completada")return "Completadas";if(!task.due_date)return "Sin fecha";const today=todayString();if(task.due_date<today)return "Vencidas";if(task.due_date===today)return "Hoy";return "Próximas"}
function badgeClass(bucket){if(bucket==="Vencidas")return "bg-red-50 text-red-700 border-red-200";if(bucket==="Hoy")return "bg-amber-50 text-amber-700 border-amber-200";if(bucket==="Próximas")return "bg-blue-50 text-blue-700 border-blue-200";if(bucket==="Completadas")return "bg-emerald-50 text-emerald-700 border-emerald-200";return "bg-slate-50 text-slate-600 border-slate-200"}
function priorityClass(priority){if(priority==="Urgente")return "bg-red-100 text-red-700";if(priority==="Alta")return "bg-orange-100 text-orange-700";if(priority==="Media")return "bg-blue-100 text-blue-700";return "bg-slate-100 text-slate-600"}
function ActionButton({ children, onClick, danger=false, secondary=false, disabled=false, type="button", small=false }){
  return <button type={type} disabled={disabled} onClick={onClick} className={`${small?"px-3 py-1.5 text-xs":"px-4 py-2 text-sm"} rounded-xl border shadow-sm disabled:opacity-50 ${danger?"bg-red-600 text-white border-red-600":secondary?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>{children}</button>
}
function localListsKey(userId){return `mecano-task-lists-${userId||"local"}`}
function getTaskList(task){return task.task_list||task.list_name||"Pendientes"}

export default function TasksModule({ currentUser, leads, onOpenLead, prefillLead, onPrefillConsumed }){
  const userId=currentUser?.id||"";
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("Abiertas");
  const [editingId,setEditingId]=useState(null);
  const [lists,setLists]=useState(DEFAULT_TASK_LISTS);
  const [activeList,setActiveList]=useState(DEFAULT_TASK_LISTS[0]);
  const [listNameInput,setListNameInput]=useState("");
  const [draft,setDraft]=useState(emptyTaskDraft(userId,null,DEFAULT_TASK_LISTS[0]));

  const leadMap=useMemo(()=>new Map((leads||[]).map((lead)=>[String(lead.id),lead])),[leads]);

  useEffect(()=>{
    try{const raw=localStorage.getItem(localListsKey(userId));if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length){setLists(parsed);setActiveList(parsed[0]);setDraft(emptyTaskDraft(userId,null,parsed[0]));return;}}}catch(err){console.warn("No pude cargar listas locales",err)}
    setLists(DEFAULT_TASK_LISTS);setActiveList(DEFAULT_TASK_LISTS[0]);setDraft(emptyTaskDraft(userId,null,DEFAULT_TASK_LISTS[0]));
  },[userId]);

  useEffect(()=>{try{localStorage.setItem(localListsKey(userId),JSON.stringify(lists))}catch(err){console.warn("No pude guardar listas locales",err)}},[lists,userId]);

  const refresh=async()=>{
    if(!cloudEnabled){setError("El módulo de tareas requiere Supabase configurado.");return;}
    try{setLoading(true);setError("");const rows=await loadMyTasks(userId);setTasks(rows)}
    catch(err){console.error(err);setError("No pude cargar tareas. Verifica que la tabla crm_tasks exista en Supabase y que las políticas RLS estén creadas.")}
    finally{setLoading(false)}
  };

  useEffect(()=>{refresh()},[userId]);
  useEffect(()=>{if(prefillLead){setDraft(emptyTaskDraft(userId,prefillLead,activeList));setEditingId(null);onPrefillConsumed?.()}},[prefillLead,userId,activeList]);

  const grouped=useMemo(()=>{
    const base={Vencidas:[],Hoy:[],Próximas:[],"Sin fecha":[],Completadas:[]};
    for(const task of tasks){base[taskBucket(task)].push(task)}
    return base;
  },[tasks]);

  const countsByList=useMemo(()=>{
    const counts={};
    for(const item of lists)counts[item]=0;
    for(const task of tasks){const name=getTaskList(task);counts[name]=(counts[name]||0)+1}
    return counts;
  },[tasks,lists]);

  const visibleTasks=useMemo(()=>{
    let rows=activeList==="Todas"?tasks:tasks.filter((task)=>getTaskList(task)===activeList);
    if(filter==="Abiertas")return rows.filter((task)=>task.status!=="Completada"&&task.status!=="Cancelada");
    if(filter==="Todas")return rows;
    return rows.filter((task)=>taskBucket(task)===filter);
  },[tasks,filter,activeList]);

  const resetForm=()=>{setEditingId(null);setDraft(emptyTaskDraft(userId,null,activeList==="Todas"?lists[0]:activeList))};
  const startEdit=(task)=>{setEditingId(task.id);setDraft({...task,due_date:task.due_date||"",due_time:task.due_time||"",lead_id:task.lead_id||"",task_list:getTaskList(task)})};
  const addList=()=>{const cleanName=String(listNameInput||"").trim();if(!cleanName)return;const exists=lists.some((item)=>item.toLowerCase()===cleanName.toLowerCase());if(exists){alert("Esa lista ya existe.");return;}const next=[...lists,cleanName];setLists(next);setActiveList(cleanName);setDraft((prev)=>({...prev,task_list:cleanName}));setListNameInput("")};
  const removeList=(name)=>{if(!name)return;const count=countsByList[name]||0;const message=count?`La lista ${name} tiene ${count} tarea(s). No se borrarán las tareas, pero quedarán ocultas hasta reasignarlas. ¿Deseas borrar la lista?`:`¿Borrar la lista ${name}?`;if(!window.confirm(message))return;const next=lists.filter((item)=>item!==name);setLists(next.length?next:DEFAULT_TASK_LISTS);setActiveList(next[0]||DEFAULT_TASK_LISTS[0]);};

  const saveTask=async(e)=>{
    e.preventDefault();
    try{
      setError("");
      const payload={...draft,task_list:draft.task_list||activeList||lists[0]};
      if(editingId){await updateTask(editingId,payload)}else{await createTask(payload,userId)}
      await refresh();
      resetForm();
    }catch(err){console.error(err);setError(err.message||"No pude guardar la tarea.")}
  };

  const markComplete=async(taskId)=>{try{await completeTask(taskId);await refresh()}catch(err){console.error(err);setError("No pude completar la tarea.")}};
  const removeTask=async(taskId)=>{if(!window.confirm("¿Eliminar esta tarea?"))return;try{await deleteTask(taskId);await refresh()}catch(err){console.error(err);setError("No pude eliminar la tarea.")}};

  return <div className="space-y-6">
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Mis tareas y recordatorios</div>
          <div className="text-sm text-slate-500">Panel personal por usuario, organizado por listas tipo Google Tasks.</div>
        </div>
        <div className="flex gap-2"><ActionButton onClick={refresh}>Actualizar</ActionButton><ActionButton secondary onClick={resetForm}>Nueva tarea</ActionButton></div>
      </div>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-sm font-semibold text-red-700">Vencidas</div><div className="text-3xl font-bold text-red-700">{grouped.Vencidas.length}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-semibold text-amber-700">Hoy</div><div className="text-3xl font-bold text-amber-700">{grouped.Hoy.length}</div></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="text-sm font-semibold text-blue-700">Próximas</div><div className="text-3xl font-bold text-blue-700">{grouped.Próximas.length}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm font-semibold text-emerald-700">Completadas</div><div className="text-3xl font-bold text-emerald-700">{grouped.Completadas.length}</div></div>
      </div>
    </div>

    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    <div className="grid grid-cols-1 xl:grid-cols-[280px_0.8fr_1.2fr] gap-6">
      <aside className="rounded-3xl border bg-white p-5 shadow-sm h-fit">
        <div className="mb-3 text-lg font-semibold">Listas</div>
        <div className="space-y-2">
          <button type="button" onClick={()=>setActiveList("Todas")} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${activeList==="Todas"?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-700"}`}><span>Todas las tareas</span></button>
          {lists.map((name)=><div key={name} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeList===name?"bg-blue-50 border-blue-200":"bg-white border-slate-200"}`}>
            <button type="button" className="flex-1 text-left" onClick={()=>{setActiveList(name);setDraft((prev)=>({...prev,task_list:name}))}}><div className="font-medium">{name}</div><div className="text-xs text-slate-500">{countsByList[name]||0} tarea(s)</div></button>
            <button type="button" className="text-red-600" onClick={()=>removeList(name)}>✕</button>
          </div>)}
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 text-sm font-medium text-slate-700">Crear lista</div>
          <input className="mb-2 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Ej: Ricardo pendientes" value={listNameInput} onChange={(e)=>setListNameInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")addList()}} />
          <ActionButton onClick={addList} small>Crear lista</ActionButton>
        </div>
      </aside>

      <form onSubmit={saveTask} className="rounded-3xl border bg-white p-5 shadow-sm space-y-3 h-fit">
        <div><div className="text-lg font-semibold">{editingId?"Editar tarea":"Crear tarea"}</div><div className="text-sm text-slate-500">Cada tarea queda dentro de una lista y puede asociarse a un lead.</div></div>
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Título de la tarea" value={draft.title||""} onChange={(e)=>setDraft({...draft,title:e.target.value})} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="rounded-xl border px-3 py-2" value={draft.task_list||activeList||lists[0]} onChange={(e)=>setDraft({...draft,task_list:e.target.value})}>{lists.map((item)=><option key={item}>{item}</option>)}</select>
          <select className="rounded-xl border px-3 py-2" value={draft.task_type||"Hacer seguimiento"} onChange={(e)=>setDraft({...draft,task_type:e.target.value})}>{TASK_TYPES.map((item)=><option key={item}>{item}</option>)}</select>
          <select className="rounded-xl border px-3 py-2" value={draft.priority||"Media"} onChange={(e)=>setDraft({...draft,priority:e.target.value})}>{TASK_PRIORITIES.map((item)=><option key={item}>{item}</option>)}</select>
          <select className="rounded-xl border px-3 py-2" value={draft.status||"Pendiente"} onChange={(e)=>setDraft({...draft,status:e.target.value,completed_at:e.target.value==="Completada"?new Date().toISOString():null})}>{TASK_STATUSES.map((item)=><option key={item}>{item}</option>)}</select>
          <select className="rounded-xl border px-3 py-2 md:col-span-2" value={draft.lead_id||""} onChange={(e)=>setDraft({...draft,lead_id:e.target.value})}><option value="">Sin lead asociado</option>{(leads||[]).map((lead)=><option key={lead.id} value={String(lead.id)}>{lead.empresa}</option>)}</select>
          <div className="space-y-1"><label className="text-xs text-slate-500">Fecha límite</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={draft.due_date||""} onChange={(e)=>setDraft({...draft,due_date:e.target.value})} /></div>
          <div className="space-y-1"><label className="text-xs text-slate-500">Hora</label><input className="w-full rounded-xl border px-3 py-2" type="time" value={draft.due_time||""} onChange={(e)=>setDraft({...draft,due_time:e.target.value})} /></div>
        </div>
        <textarea className="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="Descripción / notas" value={draft.description||""} onChange={(e)=>setDraft({...draft,description:e.target.value})} />
        <div className="flex justify-end gap-2"><ActionButton onClick={resetForm}>Limpiar</ActionButton><ActionButton type="submit" secondary>{editingId?"Guardar cambios":"Crear tarea"}</ActionButton></div>
      </form>

      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-lg font-semibold">{activeList==="Todas"?"Todas las tareas":activeList}</div><div className="text-sm text-slate-500">{loading?"Cargando...":`${visibleTasks.length} tarea(s) visibles`}</div></div>
          <div className="flex flex-wrap gap-2">{["Abiertas","Vencidas","Hoy","Próximas","Completadas","Todas"].map((item)=><button key={item} onClick={()=>setFilter(item)} className={`rounded-full border px-3 py-1 text-sm ${filter===item?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-700 border-slate-200"}`}>{item}</button>)}</div>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {visibleTasks.length?visibleTasks.map((task)=>{const lead=task.lead_id?leadMap.get(String(task.lead_id)):null;const bucket=taskBucket(task);return <div key={task.id} className="rounded-2xl border border-slate-200 p-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-base font-semibold text-slate-900">{task.title}</div><div className="mt-1 text-slate-500">{task.description||"Sin descripción"}</div></div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{getTaskList(task)}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(bucket)}`}>{bucket}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(task.priority)}`}>{task.priority}</span></div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-slate-400">Tipo</div><div className="font-medium">{task.task_type}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-slate-400">Fecha</div><div className="font-medium">{formatDate(task.due_date)}{task.due_time?` · ${task.due_time}`:""}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-slate-400">Lead</div><div className="font-medium">{lead?.empresa||"Sin lead asociado"}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {lead&&<ActionButton small onClick={()=>onOpenLead?.(lead.id)}>Abrir lead</ActionButton>}
              <ActionButton small onClick={()=>startEdit(task)}>Editar</ActionButton>
              {task.status!=="Completada"&&<ActionButton small secondary onClick={()=>markComplete(task.id)}>Completar</ActionButton>}
              <ActionButton small danger onClick={()=>removeTask(task.id)}>Eliminar</ActionButton>
            </div>
          </div>}):<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No hay tareas para este filtro o lista.</div>}
        </div>
      </div>
    </div>
  </div>
}
