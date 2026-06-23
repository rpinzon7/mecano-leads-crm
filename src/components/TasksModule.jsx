import React, { useEffect, useMemo, useState } from "react";
import { cloudEnabled } from "../lib/supabase";
import { canDeleteAnyTask, completeTask, createAlertRecipient, createTask, DEFAULT_ALERT_RECIPIENTS, deleteAlertRecipient, deleteTask, emptyTaskDraft, getTaskUserLabel, isTaskAdminProfile, loadAlertRecipients, loadTaskProfile, loadTasks, loadTaskUsers, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, updateAlertRecipient, updateTask } from "../lib/tasksService";

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
function getLeadLabel(lead){if(!lead)return "Sin lead asociado";const empresa=String(lead.empresa||"Sin empresa").trim()||"Sin empresa";const proyecto=String(lead.proyecto||"Sin proyecto").trim()||"Sin proyecto";return `${empresa} — ${proyecto}`}
function normalizeText(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}

function emptyRecipientDraft(){return {name:"",email:"",whatsapp:"",role:"",active:true}}
function chooseRecipientFromList(channel, recipients){
  const activeRecipients=(recipients||[]).filter((person)=>person.active!==false);
  const label=channel==="email"?"correo":"WhatsApp";
  const options=activeRecipients.map((person,index)=>`${index+1}. ${person.name}${person.role?` — ${person.role}`:""}`).join("\n");
  const manualNumber=activeRecipients.length+1;
  const selected=window.prompt(`Selecciona responsable para enviar alerta por ${label}:\n\n${options||"No hay responsables activos."}\n${manualNumber}. Otro / manual\n\nEscribe el número de la opción:`);
  if(!selected)return null;
  const number=Number(String(selected).trim());
  if(number>=1&&number<=activeRecipients.length)return activeRecipients[number-1];
  if(number===manualNumber){
    const name=window.prompt("Nombre del responsable:", "Otro responsable");
    if(!name)return null;
    return {id:`manual-${Date.now()}`, name, email:"", whatsapp:"", role:"", active:true, manual:true};
  }
  alert("Opción no válida.");
  return null;
}
function formatDateTime(value=new Date()){try{return value.toLocaleString("es-CO",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return new Date().toISOString()}}
function getAlertTraceLines(description){return String(description||"").split("\n").map((line)=>line.trim()).filter((line)=>line.includes("[Alerta CRM"))}
function cleanTaskDescription(description){return String(description||"").split("\n").filter((line)=>!line.includes("[Alerta CRM")).join("\n").trim()}
function formatAlertTrace(line){
  const cleaned=String(line||"").replace(/^\[/,"").replace(/\]$/,"");
  const match=cleaned.match(/^Alerta CRM (.+?) registrada el (.+?) por (.+?) para (.+)$/);
  if(!match)return {channel:"Alerta",date:"",sender:"",destination:cleaned,raw:cleaned};
  return {channel:match[1],date:match[2],sender:match[3],destination:match[4],raw:cleaned};
}

function chooseEmailDeliveryMethod(){
  const selected=window.prompt([
    "¿Dónde quieres abrir el correo?",
    "",
    "1. Outlook / aplicación predeterminada del equipo",
    "2. Gmail web",
    "3. Outlook web",
    "4. Copiar asunto y mensaje",
    "",
    "Escribe el número de la opción:"
  ].join("\n"), "2");
  if(!selected)return null;
  const option=String(selected).trim();
  if(option==="1")return {id:"mailto",label:"correo app predeterminada"};
  if(option==="2")return {id:"gmail",label:"correo Gmail web"};
  if(option==="3")return {id:"outlook_web",label:"correo Outlook web"};
  if(option==="4")return {id:"copy",label:"correo copiado"};
  alert("Opción no válida.");
  return null;
}
function openEmailComposer(method, email, subjectText, bodyText){
  const to=encodeURIComponent(email);
  const subject=encodeURIComponent(subjectText);
  const body=encodeURIComponent(bodyText);
  if(method.id==="gmail"){
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,"_blank","noopener,noreferrer");
    return "Se abrió Gmail web con el correo prellenado.";
  }
  if(method.id==="outlook_web"){
    window.open(`https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,"_blank","noopener,noreferrer");
    return "Se abrió Outlook web con el correo prellenado.";
  }
  if(method.id==="copy"){
    const text=`Para: ${email}\nAsunto: ${subjectText}\n\n${bodyText}`;
    try{navigator.clipboard?.writeText(text)}catch(err){console.warn("No pude copiar al portapapeles",err)}
    window.prompt("Copia este mensaje y pégalo en tu correo o webmail:", text);
    return "Se preparó el texto para copiar en el correo o webmail.";
  }
  window.location.href=`mailto:${to}?subject=${subject}&body=${body}`;
  return "Se abrió la aplicación predeterminada de correo.";
}

function buildAlertSubject(task, lead){const leadName=lead?getLeadLabel(lead):"Sin lead asociado";return `Tarea vencida en CRM Mecano - ${leadName}`}
function buildAlertBody(task, lead, senderEmail=""){
  const leadName=lead?getLeadLabel(lead):"Sin lead asociado";
  return [
    "Hola,",
    "",
    "Tienes una tarea vencida en el CRM Mecano:",
    "",
    `Tarea: ${task.title||"Sin título"}`,
    `Cliente / Proyecto: ${leadName}`,
    `Tipo: ${task.task_type||"Sin tipo"}`,
    `Prioridad: ${task.priority||"Sin prioridad"}`,
    `Fecha límite: ${formatDate(task.due_date)}${task.due_time?` · ${task.due_time}`:""}`,
    cleanTaskDescription(task.description)?`Notas: ${cleanTaskDescription(task.description)}`:"Notas: Sin descripción",
    "",
    "Por favor revisa el CRM, actualiza el estado de la tarea o reprograma el seguimiento si aplica.",
    "",
    senderEmail?`Enviado por: ${senderEmail}`:"Enviado desde CRM Mecano",
  ].join("\n");
}
function onlyPhoneDigits(value){return String(value||"").replace(/[^0-9]/g,"")}
function appendAlertTrace(description, channel, destination, senderEmail){
  const trace=`[Alerta CRM ${channel} registrada el ${formatDateTime(new Date())} por ${senderEmail||"usuario CRM"} para ${destination||"destinatario no definido"}]`;
  const base=String(description||"").trim();
  return base?`${base}\n\n${trace}`:trace;
}

export default function TasksModule({ currentUser, leads, onOpenLead, prefillLead, onPrefillConsumed }){
  const userId=currentUser?.id||"";
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("Abiertas");
  const [searchQuery,setSearchQuery]=useState("");
  const [priorityFilter,setPriorityFilter]=useState("Todas");
  const [typeFilter,setTypeFilter]=useState("Todos");
  const [leadFilter,setLeadFilter]=useState("Todos");
  const [responsibleFilter,setResponsibleFilter]=useState("Todos");
  const [taskViewMode,setTaskViewMode]=useState("mine");
  const [editingId,setEditingId]=useState(null);
  const [lists,setLists]=useState(DEFAULT_TASK_LISTS);
  const [activeList,setActiveList]=useState(DEFAULT_TASK_LISTS[0]);
  const [listNameInput,setListNameInput]=useState("");
  const [draft,setDraft]=useState(emptyTaskDraft(userId,null,DEFAULT_TASK_LISTS[0]));
  const [taskProfile,setTaskProfile]=useState(null);
  const [taskUsers,setTaskUsers]=useState([]);
  const [taskUsersError,setTaskUsersError]=useState("");
  const [alertRecipients,setAlertRecipients]=useState(DEFAULT_ALERT_RECIPIENTS);
  const [recipientsLoading,setRecipientsLoading]=useState(false);
  const [recipientsError,setRecipientsError]=useState("");
  const [recipientDraft,setRecipientDraft]=useState(emptyRecipientDraft());
  const [editingRecipientId,setEditingRecipientId]=useState(null);

  const leadMap=useMemo(()=>new Map((leads||[]).map((lead)=>[String(lead.id),lead])),[leads]);
  const isTaskAdmin=isTaskAdminProfile(taskProfile);
  const canDeleteTasks=canDeleteAnyTask(taskProfile);
  const taskUserMap=useMemo(()=>new Map((taskUsers||[]).map((user)=>[String(user.user_id||user.id),user])),[taskUsers]);
  const taskUserOptions=useMemo(()=>{
    const rows=Array.isArray(taskUsers)?taskUsers:[];
    const exists=rows.some((user)=>String(user.user_id||user.id)===String(userId));
    const currentFallback=userId&&!exists?[{user_id:userId,email:currentUser?.email||"",full_name:currentUser?.user_metadata?.full_name||currentUser?.email||"Usuario actual",active:true,role:"user"}]:[];
    return [...rows,...currentFallback].filter((user)=>user.active!==false);
  },[taskUsers,userId,currentUser]);
  const getAssigneeLabel=(assignedTo)=>getTaskUserLabel(taskUserMap.get(String(assignedTo))||taskUserOptions.find((user)=>String(user.user_id||user.id)===String(assignedTo))||{email:String(assignedTo||""),full_name:String(assignedTo||"Sin responsable")});

  useEffect(()=>{
    try{const raw=localStorage.getItem(localListsKey(userId));if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length){setLists(parsed);setActiveList(parsed[0]);setDraft(emptyTaskDraft(userId,null,parsed[0]));return;}}}catch(err){console.warn("No pude cargar listas locales",err)}
    setLists(DEFAULT_TASK_LISTS);setActiveList(DEFAULT_TASK_LISTS[0]);setDraft(emptyTaskDraft(userId,null,DEFAULT_TASK_LISTS[0]));
  },[userId]);

  useEffect(()=>{try{localStorage.setItem(localListsKey(userId),JSON.stringify(lists))}catch(err){console.warn("No pude guardar listas locales",err)}},[lists,userId]);

  const refresh=async()=>{
    if(!cloudEnabled){setError("El módulo de tareas requiere Supabase configurado.");return;}
    try{
      setLoading(true);
      setError("");
      const rows=await loadTasks(userId,{viewMode:taskViewMode,assignedTo:responsibleFilter,isAdmin:isTaskAdmin});
      setTasks(rows);
    }
    catch(err){console.error(err);setError("No pude cargar tareas. Verifica que las tablas crm_tasks / crm_task_users existan en Supabase y que las políticas RLS estén creadas.")}
    finally{setLoading(false)}
  };

  const refreshTaskContext=async()=>{
    if(!cloudEnabled)return;
    try{
      setTaskUsersError("");
      const [profile,users]=await Promise.all([loadTaskProfile(currentUser),loadTaskUsers(currentUser)]);
      setTaskProfile(profile);
      setTaskUsers(users);
    }catch(err){
      console.error(err);
      setTaskUsersError("No pude cargar usuarios/roles de tareas. Ejecuta el SQL de administrador global de tareas.");
    }
  };

  const refreshRecipients=async()=>{
    if(!cloudEnabled){setRecipientsError("Supabase no está configurado. Se muestran responsables base locales.");setAlertRecipients(DEFAULT_ALERT_RECIPIENTS);return;}
    try{
      setRecipientsLoading(true);
      setRecipientsError("");
      const rows=await loadAlertRecipients();
      setAlertRecipients(rows.length?rows:DEFAULT_ALERT_RECIPIENTS);
    }catch(err){
      console.error(err);
      setRecipientsError("No pude cargar la tabla crm_alert_recipients. Ejecuta el SQL incluido en Supabase. Mientras tanto se muestran responsables base locales.");
      setAlertRecipients(DEFAULT_ALERT_RECIPIENTS);
    }finally{setRecipientsLoading(false)}
  };

  useEffect(()=>{refreshTaskContext();refreshRecipients()},[userId]);
  useEffect(()=>{refresh()},[userId,taskViewMode,responsibleFilter,isTaskAdmin]);
  useEffect(()=>{if(prefillLead){setDraft(emptyTaskDraft(userId,prefillLead,activeList));setEditingId(null);onPrefillConsumed?.()}},[prefillLead,userId,activeList]);

  const grouped=useMemo(()=>{
    const base={Vencidas:[],Hoy:[],Próximas:[],"Sin fecha":[],Completadas:[]};
    for(const task of tasks){base[taskBucket(task)].push(task)}
    return base;
  },[tasks]);

  const overdueCriticalCount=useMemo(()=>grouped.Vencidas.filter((task)=>["Urgente","Alta"].includes(task.priority)).length,[grouped.Vencidas]);
  const myTaskCount=useMemo(()=>tasks.filter((task)=>String(task.assigned_to)===String(userId)).length,[tasks,userId]);

  const countsByList=useMemo(()=>{
    const counts={};
    for(const item of lists)counts[item]=0;
    for(const task of tasks){const name=getTaskList(task);counts[name]=(counts[name]||0)+1}
    return counts;
  },[tasks,lists]);

  const visibleTasks=useMemo(()=>{
    const query=normalizeText(searchQuery);
    let rows=activeList==="Todas"?tasks:tasks.filter((task)=>getTaskList(task)===activeList);

    if(filter==="Abiertas")rows=rows.filter((task)=>task.status!=="Completada"&&task.status!=="Cancelada");
    else if(filter!=="Todas")rows=rows.filter((task)=>taskBucket(task)===filter);

    if(priorityFilter!=="Todas")rows=rows.filter((task)=>task.priority===priorityFilter);
    if(typeFilter!=="Todos")rows=rows.filter((task)=>task.task_type===typeFilter);
    if(leadFilter==="Con lead")rows=rows.filter((task)=>Boolean(task.lead_id));
    if(leadFilter==="Sin lead")rows=rows.filter((task)=>!task.lead_id);
    if(isTaskAdmin&&responsibleFilter!=="Todos")rows=rows.filter((task)=>String(task.assigned_to)===String(responsibleFilter));

    if(query){
      rows=rows.filter((task)=>{
        const lead=task.lead_id?leadMap.get(String(task.lead_id)):null;
        const haystack=[
          task.title,
          task.description,
          task.task_type,
          task.status,
          task.priority,
          getTaskList(task),
          task.due_date,
          task.due_time,
          lead?.empresa,
          lead?.proyecto,
          lead?.contacto,
          lead?.correo,
          lead?.telefono,
          getLeadLabel(lead),
          getAssigneeLabel(task.assigned_to),
        ].map(normalizeText).join(" ");
        return haystack.includes(query);
      });
    }

    return rows;
  },[tasks,filter,activeList,searchQuery,priorityFilter,typeFilter,leadFilter,responsibleFilter,isTaskAdmin,leadMap,taskUserMap,taskUserOptions]);

  const hasAdvancedFilters=Boolean(searchQuery)||priorityFilter!=="Todas"||typeFilter!=="Todos"||leadFilter!=="Todos";
  const clearAdvancedFilters=()=>{setSearchQuery("");setPriorityFilter("Todas");setTypeFilter("Todos");setLeadFilter("Todos");if(isTaskAdmin)setResponsibleFilter("Todos")};

  const resetForm=()=>{setEditingId(null);const base=emptyTaskDraft(userId,null,activeList==="Todas"?lists[0]:activeList);setDraft({...base,assigned_to:isTaskAdmin&&responsibleFilter!=="Todos"?responsibleFilter:userId})};
  const startEdit=(task)=>{setEditingId(task.id);setDraft({...task,description:cleanTaskDescription(task.description),due_date:task.due_date||"",due_time:task.due_time||"",lead_id:task.lead_id||"",task_list:getTaskList(task)})};
  const addList=()=>{const cleanName=String(listNameInput||"").trim();if(!cleanName)return;const exists=lists.some((item)=>item.toLowerCase()===cleanName.toLowerCase());if(exists){alert("Esa lista ya existe.");return;}const next=[...lists,cleanName];setLists(next);setActiveList(cleanName);setDraft((prev)=>({...prev,task_list:cleanName}));setListNameInput("")};
  const removeList=(name)=>{if(!name)return;const count=countsByList[name]||0;const message=count?`La lista ${name} tiene ${count} tarea(s). No se borrarán las tareas, pero quedarán ocultas hasta reasignarlas. ¿Deseas borrar la lista?`:`¿Borrar la lista ${name}?`;if(!window.confirm(message))return;const next=lists.filter((item)=>item!==name);setLists(next.length?next:DEFAULT_TASK_LISTS);setActiveList(next[0]||DEFAULT_TASK_LISTS[0]);};

  const resetRecipientForm=()=>{setEditingRecipientId(null);setRecipientDraft(emptyRecipientDraft())};
  const startEditRecipient=(recipient)=>{setEditingRecipientId(recipient.id);setRecipientDraft({name:recipient.name||"",email:recipient.email||"",whatsapp:recipient.whatsapp||"",role:recipient.role||"",active:recipient.active!==false})};
  const saveRecipient=async(e)=>{
    e.preventDefault();
    try{
      setRecipientsError("");
      if(editingRecipientId){await updateAlertRecipient(editingRecipientId,recipientDraft)}
      else{await createAlertRecipient(recipientDraft)}
      await refreshRecipients();
      resetRecipientForm();
    }catch(err){console.error(err);setRecipientsError(err.message||"No pude guardar el responsable. Verifica que la tabla crm_alert_recipients exista en Supabase.")}
  };
  const removeRecipient=async(recipient)=>{
    if(!window.confirm(`¿Eliminar a ${recipient.name} de responsables de alertas?`))return;
    try{setRecipientsError("");await deleteAlertRecipient(recipient.id);await refreshRecipients();if(editingRecipientId===recipient.id)resetRecipientForm()}
    catch(err){console.error(err);setRecipientsError("No pude eliminar el responsable.")}
  };
  const toggleRecipientActive=async(recipient)=>{
    try{setRecipientsError("");await updateAlertRecipient(recipient.id,{...recipient,active:recipient.active===false});await refreshRecipients()}
    catch(err){console.error(err);setRecipientsError("No pude cambiar el estado del responsable.")}
  };

  const saveTask=async(e)=>{
    e.preventDefault();
    try{
      setError("");
      let payload={...draft,task_list:draft.task_list||activeList||lists[0],assigned_to:isTaskAdmin?(draft.assigned_to||userId):userId};
      if(editingId){
        const original=tasks.find((task)=>task.id===editingId);
        const traces=getAlertTraceLines(original?.description).join("\n\n");
        const cleanDescription=String(payload.description||"").trim();
        payload={...payload,description:traces?(cleanDescription?`${cleanDescription}\n\n${traces}`:traces):cleanDescription};
        await updateTask(editingId,payload)
      }else{await createTask(payload,userId)}
      await refresh();
      resetForm();
    }catch(err){console.error(err);setError(err.message||"No pude guardar la tarea.")}
  };

  const markComplete=async(taskId)=>{try{await completeTask(taskId);await refresh()}catch(err){console.error(err);setError("No pude completar la tarea.")}};
  const removeTask=async(task)=>{if(!task?.id)return;if(!canDeleteTasks&&String(task.assigned_to)!==String(userId)){setError("No tienes permiso para eliminar tareas de otro usuario.");return;}if(!window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer."))return;try{await deleteTask(task.id);await refresh()}catch(err){console.error(err);setError("No pude eliminar la tarea.")}};

  const registerAlertTrace=async(task, channel, destination)=>{
    const description=appendAlertTrace(task.description, channel, destination, currentUser?.email||"");
    await updateTask(task.id,{description});
    await refresh();
  };

  const sendOverdueEmailAlert=async(task, lead)=>{
    const recipient=chooseRecipientFromList("email",alertRecipients);
    if(!recipient)return;
    const email=window.prompt(`Correo para ${recipient.name}:`, recipient.email||"");
    if(!email)return;
    if(!recipient.manual&&email!==recipient.email){
      try{await updateAlertRecipient(recipient.id,{...recipient,email});await refreshRecipients()}
      catch(err){console.warn("No pude actualizar correo del responsable",err)}
    }
    const method=chooseEmailDeliveryMethod();
    if(!method)return;
    const subjectText=buildAlertSubject(task,lead);
    const bodyText=buildAlertBody(task,lead,currentUser?.email||"");
    const openMessage=openEmailComposer(method,email,subjectText,bodyText);
    try{await registerAlertTrace(task,`por ${method.label}`,`${recipient.name} <${email}>`);alert(`${openMessage} Quedó registrada la trazabilidad en la tarea.`)}
    catch(err){console.error(err);setError("Se abrió/preparó el correo, pero no pude registrar la trazabilidad en la tarea.")}
  };

  const sendOverdueWhatsAppAlert=async(task, lead)=>{
    const recipient=chooseRecipientFromList("whatsapp",alertRecipients);
    if(!recipient)return;
    const phone=window.prompt(`WhatsApp de ${recipient.name}, con indicativo de país. Ej: 573001112233`, recipient.whatsapp||"");
    if(!phone)return;
    const cleanPhone=onlyPhoneDigits(phone);
    if(!cleanPhone){alert("Ingresa un número válido para WhatsApp.");return;}
    if(!recipient.manual&&cleanPhone!==recipient.whatsapp){
      try{await updateAlertRecipient(recipient.id,{...recipient,whatsapp:cleanPhone});await refreshRecipients()}
      catch(err){console.warn("No pude actualizar WhatsApp del responsable",err)}
    }
    const text=encodeURIComponent(buildAlertBody(task,lead,currentUser?.email||""));
    window.open(`https://wa.me/${cleanPhone}?text=${text}`,"_blank","noopener,noreferrer");
    try{await registerAlertTrace(task,"por WhatsApp",`${recipient.name} <+${cleanPhone}>`);alert(`Se abrió WhatsApp para ${recipient.name} con el mensaje prellenado y quedó registrada la trazabilidad en la tarea.`)}
    catch(err){console.error(err);setError("Se abrió WhatsApp, pero no pude registrar la trazabilidad en la tarea.")}
  };

  return <div className="space-y-6">
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Tareas y recordatorios</div>
          <div className="text-sm text-slate-500">Panel personal y, para administradores de tareas, administración global del equipo comercial.</div>
        </div>
        <div className="flex gap-2"><ActionButton onClick={refresh}>Actualizar</ActionButton><ActionButton secondary onClick={resetForm}>Nueva tarea</ActionButton></div>
      </div>
      {taskUsersError&&<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{taskUsersError}</div>}
      {isTaskAdmin&&<div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-blue-800">Administrador global de tareas</div>
            <div className="text-xs text-blue-700">Puedes ver, crear, editar, reasignar, cerrar y eliminar tareas del equipo comercial.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>setTaskViewMode("mine")} className={`rounded-full border px-3 py-1.5 text-sm ${taskViewMode==="mine"?"bg-blue-900 text-white border-blue-900":"bg-white text-blue-800 border-blue-200"}`}>Mis tareas</button>
            <button type="button" onClick={()=>setTaskViewMode("all")} className={`rounded-full border px-3 py-1.5 text-sm ${taskViewMode==="all"?"bg-blue-900 text-white border-blue-900":"bg-white text-blue-800 border-blue-200"}`}>Todo el equipo</button>
            <select className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm" value={responsibleFilter} onChange={(e)=>setResponsibleFilter(e.target.value)} disabled={taskViewMode!=="all"}>
              <option value="Todos">Todos los responsables</option>
              {taskUserOptions.map((user)=><option key={user.user_id||user.id} value={user.user_id||user.id}>{getTaskUserLabel(user)}</option>)}
            </select>
          </div>
        </div>
      </div>}

      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-sm font-semibold text-red-700">Vencidas</div><div className="text-3xl font-bold text-red-700">{grouped.Vencidas.length}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-semibold text-amber-700">Hoy</div><div className="text-3xl font-bold text-amber-700">{grouped.Hoy.length}</div></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="text-sm font-semibold text-blue-700">Próximas</div><div className="text-3xl font-bold text-blue-700">{grouped.Próximas.length}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm font-semibold text-emerald-700">Completadas</div><div className="text-3xl font-bold text-emerald-700">{grouped.Completadas.length}</div></div>
      </div>
    </div>

    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    {grouped.Vencidas.length>0&&<div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-red-800">Alertas de tareas vencidas</div>
          <div className="text-sm text-red-700">Tienes {grouped.Vencidas.length} tarea(s) vencida(s). {overdueCriticalCount>0?`${overdueCriticalCount} son de prioridad alta o urgente.`:""}</div>
          <div className="mt-1 text-xs text-red-600">Desde cada tarea vencida puedes seleccionar un responsable, abrir correo o WhatsApp prellenado y dejar trazabilidad en la descripción de la tarea.</div>
        </div>
        <ActionButton danger onClick={()=>setFilter("Vencidas")}>Ver vencidas</ActionButton>
      </div>
    </div>}

    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
      <div className="space-y-6">
      <aside className="rounded-3xl border bg-white p-5 shadow-sm h-fit">
        <div className="mb-3 text-lg font-semibold">Listas</div>
        <div className="space-y-1.5">
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
          <div className="space-y-1 md:col-span-2"><label className="text-xs text-slate-500">Responsable de la tarea</label><select className="w-full rounded-xl border px-3 py-2" value={draft.assigned_to||userId} onChange={(e)=>setDraft({...draft,assigned_to:e.target.value})} disabled={!isTaskAdmin}>{taskUserOptions.map((user)=><option key={user.user_id||user.id} value={user.user_id||user.id}>{getTaskUserLabel(user)}</option>)}</select>{!isTaskAdmin&&<div className="text-[11px] text-slate-400">Solo un administrador de tareas puede asignar o reasignar tareas a otros usuarios.</div>}</div>
          <select className="rounded-xl border px-3 py-2 md:col-span-2" value={draft.lead_id||""} onChange={(e)=>setDraft({...draft,lead_id:e.target.value})}><option value="">Sin lead asociado</option>{(leads||[]).map((lead)=><option key={lead.id} value={String(lead.id)}>{getLeadLabel(lead)}</option>)}</select>
          <div className="space-y-1"><label className="text-xs text-slate-500">Fecha límite</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={draft.due_date||""} onChange={(e)=>setDraft({...draft,due_date:e.target.value})} /></div>
          <div className="space-y-1"><label className="text-xs text-slate-500">Hora</label><input className="w-full rounded-xl border px-3 py-2" type="time" value={draft.due_time||""} onChange={(e)=>setDraft({...draft,due_time:e.target.value})} /></div>
        </div>
        <textarea className="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="Descripción / notas" value={draft.description||""} onChange={(e)=>setDraft({...draft,description:e.target.value})} />
        <div className="flex justify-end gap-2"><ActionButton onClick={resetForm}>Limpiar</ActionButton><ActionButton type="submit" secondary>{editingId?"Guardar cambios":"Crear tarea"}</ActionButton></div>
      </form>

      <section className="rounded-3xl border bg-white p-5 shadow-sm space-y-4 h-fit">
        <div>
          <div className="text-lg font-semibold">Responsables de alertas</div>
          <div className="text-sm text-slate-500">Lista central para correos y WhatsApp de tareas vencidas.</div>
        </div>
        {recipientsError&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">{recipientsError}</div>}
        <form onSubmit={saveRecipient} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Nombre responsable" value={recipientDraft.name} onChange={(e)=>setRecipientDraft({...recipientDraft,name:e.target.value})} required />
          <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Correo" value={recipientDraft.email} onChange={(e)=>setRecipientDraft({...recipientDraft,email:e.target.value})} />
          <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="WhatsApp con indicativo. Ej: 573001112233" value={recipientDraft.whatsapp} onChange={(e)=>setRecipientDraft({...recipientDraft,whatsapp:onlyPhoneDigits(e.target.value)})} />
          <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Cargo / área" value={recipientDraft.role} onChange={(e)=>setRecipientDraft({...recipientDraft,role:e.target.value})} />
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={recipientDraft.active!==false} onChange={(e)=>setRecipientDraft({...recipientDraft,active:e.target.checked})} /> Activo para alertas</label>
          <div className="flex justify-end gap-2"><ActionButton onClick={resetRecipientForm} small>Cancelar</ActionButton><ActionButton type="submit" secondary small>{editingRecipientId?"Guardar":"Agregar"}</ActionButton></div>
        </form>
        <div className="space-y-1.5">
          {recipientsLoading&&<div className="text-xs text-slate-500">Cargando responsables...</div>}
          {(alertRecipients||[]).map((recipient)=><div key={recipient.id} className={`rounded-2xl border px-3 py-2 text-xs ${recipient.active===false?"bg-slate-50 text-slate-400":"bg-white text-slate-600"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{recipient.name}</div>
                <div>{recipient.role||"Sin cargo"}</div>
                <div className="truncate">{recipient.email||"Sin correo"}</div>
                <div>{recipient.whatsapp?`+${recipient.whatsapp}`:"Sin WhatsApp"}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${recipient.active===false?"bg-slate-200 text-slate-500":"bg-emerald-100 text-emerald-700"}`}>{recipient.active===false?"Inactivo":"Activo"}</span>
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <ActionButton small onClick={()=>startEditRecipient(recipient)}>Editar</ActionButton>
              <ActionButton small onClick={()=>toggleRecipientActive(recipient)}>{recipient.active===false?"Activar":"Desactivar"}</ActionButton>
              {!recipient.is_default&&<ActionButton small danger onClick={()=>removeRecipient(recipient)}>Eliminar</ActionButton>}
            </div>
          </div>)}
        </div>
      </section>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{activeList==="Todas"?"Todas las tareas":activeList}</div>
            <div className="text-sm text-slate-500">{loading?"Cargando...":`${visibleTasks.length} tarea(s) visibles de ${tasks.length} total(es)`}</div>
          </div>
          <div className="flex flex-wrap gap-2">{["Abiertas","Vencidas","Hoy","Próximas","Completadas","Todas"].map((item)=><button key={item} onClick={()=>setFilter(item)} className={`rounded-full border px-3 py-1 text-sm ${filter===item?"bg-slate-900 text-white border-slate-900":"bg-white text-slate-700 border-slate-200"}`}>{item}</button>)}</div>
        </div>

        <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Búsqueda y filtros</div>
              <div className="text-xs text-slate-500">Encuentra tareas por empresa, proyecto, prioridad, tipo o lead asociado.</div>
            </div>
            <div className="flex items-center gap-2">
              {hasAdvancedFilters&&<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">{visibleTasks.length} resultado(s)</span>}
              <ActionButton onClick={clearAdvancedFilters} disabled={!hasAdvancedFilters} small>Limpiar</ActionButton>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Buscar tarea, empresa, proyecto o nota</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                placeholder="Ej: Casablanca, cotización, urgente..."
                value={searchQuery}
                onChange={(e)=>setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Prioridad</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={priorityFilter} onChange={(e)=>setPriorityFilter(e.target.value)}>
                  <option>Todas</option>
                  {TASK_PRIORITIES.map((item)=><option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Tipo de tarea</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}>
                  <option>Todos</option>
                  {TASK_TYPES.map((item)=><option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Lead asociado</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={leadFilter} onChange={(e)=>setLeadFilter(e.target.value)}>
                  <option>Todos</option>
                  <option>Con lead</option>
                  <option>Sin lead</option>
                </select>
              </div>
              {isTaskAdmin&&<div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Responsable</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={responsibleFilter} onChange={(e)=>setResponsibleFilter(e.target.value)}>
                  <option value="Todos">Todos</option>
                  {taskUserOptions.map((user)=><option key={user.user_id||user.id} value={user.user_id||user.id}>{getTaskUserLabel(user)}</option>)}
                </select>
              </div>}
            </div>
          </div>
          {hasAdvancedFilters&&<div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">Filtro activo · mostrando {visibleTasks.length} resultado(s) de {tasks.length} tarea(s) total(es).</div>}
        </div>
        <div className="space-y-2 max-h-[82vh] overflow-y-auto pr-2">
          {visibleTasks.length?visibleTasks.map((task)=>{const lead=task.lead_id?leadMap.get(String(task.lead_id)):null;const bucket=taskBucket(task);const alertTraces=getAlertTraceLines(task.description).map(formatAlertTrace);const cleanDescription=cleanTaskDescription(task.description);return <div key={task.id} className={`rounded-2xl border p-3 text-sm shadow-sm ${bucket==="Vencidas"?"border-red-200 bg-red-50/40":"border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-base font-semibold text-slate-900">{task.title}</div><div className="mt-1 whitespace-pre-line text-slate-500">{cleanDescription||"Sin descripción"}</div></div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{getTaskList(task)}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(bucket)}`}>{bucket}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(task.priority)}`}>{task.priority}</span></div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 px-3 py-1.5"><div className="text-slate-400">Tipo</div><div className="font-medium">{task.task_type}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-1.5"><div className="text-slate-400">Fecha</div><div className="font-medium">{formatDate(task.due_date)}{task.due_time?` · ${task.due_time}`:""}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-1.5"><div className="text-slate-400">Lead</div><div className="font-medium">{getLeadLabel(lead)}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-1.5"><div className="text-slate-400">Responsable</div><div className="font-medium">{getAssigneeLabel(task.assigned_to)}</div></div>
            </div>
            {alertTraces.length>0&&<div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
              <div className="mb-1.5 font-semibold text-slate-800">Historial de alertas</div>
              <div className="space-y-1.5">
                {alertTraces.map((trace,index)=><div key={`${task.id}-trace-${index}`} className="grid grid-cols-1 gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 md:grid-cols-4">
                  <div><span className="text-slate-400">Fecha</span><br/><span className="font-medium text-slate-700">{trace.date||"Sin fecha"}</span></div>
                  <div><span className="text-slate-400">Canal</span><br/><span className="font-medium text-slate-700">{trace.channel}</span></div>
                  <div><span className="text-slate-400">Responsable</span><br/><span className="font-medium text-slate-700">{trace.destination}</span></div>
                  <div><span className="text-slate-400">Registrado por</span><br/><span className="font-medium text-slate-700">{trace.sender||"usuario CRM"}</span></div>
                </div>)}
              </div>
            </div>}
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              {bucket==="Vencidas"&&task.status!=="Completada"&&<ActionButton small onClick={()=>sendOverdueEmailAlert(task,lead)}>Correo responsable</ActionButton>}
              {bucket==="Vencidas"&&task.status!=="Completada"&&<ActionButton small onClick={()=>sendOverdueWhatsAppAlert(task,lead)}>WhatsApp responsable</ActionButton>}
              {lead&&<ActionButton small onClick={()=>onOpenLead?.(lead.id)}>Abrir lead</ActionButton>}
              <ActionButton small onClick={()=>startEdit(task)}>Editar</ActionButton>
              {task.status!=="Completada"&&<ActionButton small secondary onClick={()=>markComplete(task.id)}>Completar</ActionButton>}
              {(canDeleteTasks||String(task.assigned_to)===String(userId))&&<ActionButton small danger onClick={()=>removeTask(task)}>Eliminar</ActionButton>}
            </div>
          </div>}):<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No hay tareas para este filtro, búsqueda o lista.</div>}
        </div>
      </div>
    </div>
  </div>
}
