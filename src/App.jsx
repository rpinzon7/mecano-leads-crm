import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { cloudEnabled, getWorkspaceName, loadWorkspaceFromCloud, saveWorkspaceToCloud, supabase, signInWithPassword, signUpWithPassword, signOutUser } from "./lib/supabase";

const STAGES = ["Lead nuevo","Contactado","Requerimiento entendido","Cotización proveedor","Propuesta enviada","Negociación","Cerrado ganado","Cerrado perdido"];
const PROPOSAL_STATUS = ["Sin propuesta","Pendiente proveedor","En elaboración","Enviada","En revisión cliente","Ajustes solicitados","Aprobada","Rechazada"];
const LOST_FOLLOWUP_STATUS = ["Sin gestionar","Recuperable","Recontactado","Descartado"];
const STORAGE_KEY = "mecano-leads-crm-v3";
const REMINDER_FILTERS = ["Todos","Vencidos","Hoy","7 dias","Sin fecha"];

function money(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(n||0))}
function normalizeStage(value){if(!value)return"Lead nuevo";const raw=String(value).toLowerCase();if(raw.includes("negoc"))return"Negociación";if(raw.includes("propuesta")||raw.includes("presupuesto enviado"))return"Propuesta enviada";if(raw.includes("cotiz"))return"Cotización proveedor";if(raw.includes("requer"))return"Requerimiento entendido";if(raw.includes("contact"))return"Contactado";if(raw.includes("ganado"))return"Cerrado ganado";if(raw.includes("perdido"))return"Cerrado perdido";return"Lead nuevo"}
function estimateProbability(stage){switch(stage){case"Negociación":return 70;case"Propuesta enviada":return 55;case"Cotización proveedor":return 40;case"Requerimiento entendido":return 25;case"Contactado":return 15;case"Cerrado ganado":return 100;case"Cerrado perdido":return 0;default:return 5;}}
function todayString(){const d=new Date();const tzOffset=d.getTimezoneOffset()*60000;return new Date(d.getTime()-tzOffset).toISOString().slice(0,10)}
function daysBetween(from,to){const a=new Date(from+"T00:00:00");const b=new Date(to+"T00:00:00");return Math.round((b-a)/86400000)}
function getReminderBucket(dateStr){if(!dateStr)return"Sin fecha";const today=todayString();const diff=daysBetween(today,dateStr);if(diff<0)return"Vencidos";if(diff===0)return"Hoy";if(diff<=7)return"7 dias";return"Futuro"}
function reminderBadgeClass(bucket){switch(bucket){case"Vencidos":return"bg-red-100 text-red-700 border-red-200";case"Hoy":return"bg-amber-100 text-amber-700 border-amber-200";case"7 dias":return"bg-blue-100 text-blue-700 border-blue-200";case"Sin fecha":return"bg-slate-100 text-slate-600 border-slate-200";default:return"bg-emerald-100 text-emerald-700 border-emerald-200";}}
function calculatePriority(lead){let score=0;if(lead.estado==="Negociación")score+=50;if(lead.estado==="Propuesta enviada")score+=40;if(lead.estado==="Cotización proveedor")score+=30;if(Number(lead.valor)>100000)score+=20;if(Number(lead.valor)>50000)score+=10;if(lead.fechaSeguimiento)score+=5;if(lead.propuestaEstado==="En revisión cliente")score+=10;if(lead.propuestaEstado==="Ajustes solicitados")score+=12;if(lead.clientePorLlamarManual)score+=20;if(lead.estado==="Cerrado perdido"&&lead.perdidoSeguimiento!=="Descartado")score+=8;if(getReminderBucket(lead.fechaSeguimiento)==="Vencidos")score+=15;if(getReminderBucket(lead.fechaSeguimiento)==="Hoy")score+=10;return score}
function parseMoney(value){if(value==null||value==="")return 0;if(typeof value==="number")return value;const cleaned=String(value).replace(/[^\d.,-]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".");return Number(cleaned)||0}
function inferProposalStatus(row,stage){if(row["Estado de la propuesta"])return row["Estado de la propuesta"];if(row["Envio de presupuesto"])return"Enviada";if(row["Elaboracion de presupuesto"])return"En elaboración";if(stage==="Propuesta enviada")return"Enviada";if(stage==="Cotización proveedor")return"Pendiente proveedor";return"Sin propuesta"}
function inferNextTask(row){return row["Próxima tarea"]||row["PROXIMA TAREA"]||row["Solicitud de Informacion al cliente"]||row["Solicitud de cotizacion proveedor"]||row["Elaboracion de presupuesto"]||row["Envio de presupuesto"]||row["Reunion de entendimiento"]||""}
function mapRowToLead(row,index){const empresa=row.Empresa||row["RAZON SOCIAL"]||row["Razón Social"]||row["Razón social de la empreзa"]||row["Razón social de la empresa"]||row.Cliente||"";const proyecto=row["DESCRIPCION DEL REQUERIMIENTO"]||row["Descripción del requerimiento"]||row["Describa brevemente su requerimiento o proyecto"]||row.Proyecto||row.Descripcion||row["Descripción"]||"";const proveedor=row.Proveedor||row.PROVEEDOR||"";const estado=normalizeStage(row.Estado||row["% de avance"]||row["% avance"]||row.Cierre||row["Cierre"]||row.Seguimiento||"");const valor=parseMoney(row["VALOR DE LA OFERTA"]||row["Valor de la oferta"]||row.Valor||0);const probabilidad=row.Probabilidad||estimateProbability(estado);return{id:Date.now()+index,empresa,contacto:row.Contacto||"",cargo:row.Cargo||"",responsableInicial:row["Responsable Inicial"]||"",telefono:row.Telefono||row["Teléfono"]||"",email:row.Email||row.Correo||"",ciudad:row.Ciudad||"",origen:row.Origen||"Andina Pack",proyecto,proveedor,tipoMaquina:row["Tipo maquina"]||row["Tipo de máquina"]||"",capacidad:row.Capacidad||"",estado,propuestaEstado:inferProposalStatus(row,estado),valor,probabilidad,cotizacionOdoo:row["Cotización Odoo"]||row["Numero cotizacion Odoo"]||"",proximaTarea:inferNextTask(row),fechaSeguimiento:row["Fecha seguimiento"]||row["FECHA SEGUIMIENTO"]||"",ultimaInteraccion:row["Última interacción"]||row["Ultima interaccion"]||"",notas:row.SEGUIMIENTO||row.Seguimiento||row["Seguimiento"]||row.Notas||"",clientePorLlamarManual:false,perdidoSeguimiento:estado==="Cerrado perdido"?"Sin gestionar":"",motivoPerdida:""}}
function parseSpreadsheetRows(rows){return rows.map((row,index)=>mapRowToLead(row,index)).filter((r)=>r.empresa||r.proyecto)}
const emptyLead={empresa:"",contacto:"",cargo:"",responsableInicial:"",telefono:"",email:"",ciudad:"",origen:"Andina Pack",proyecto:"",proveedor:"",tipoMaquina:"",capacidad:"",estado:"Lead nuevo",propuestaEstado:"Sin propuesta",valor:"",probabilidad:5,cotizacionOdoo:"",proximaTarea:"",fechaSeguimiento:"",ultimaInteraccion:"",notas:"",clientePorLlamarManual:false,perdidoSeguimiento:"",motivoPerdida:""};
function SmallCard({title,value}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-sm text-slate-600">{title}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>}
function ActionButton({children,onClick,secondary=false,small=false,disabled=false,danger=false}){const cls=small?"px-2 py-1 text-sm":"px-3 py-2 text-sm";const base="rounded-xl border transition";let color="bg-white hover:bg-slate-50 border-slate-200 text-slate-800";if(secondary)color="bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800";if(danger)color="bg-white hover:bg-red-50 border-red-200 text-red-700";if(disabled)color+=" opacity-50 cursor-not-allowed";return <button disabled={disabled} onClick={onClick} className={`${base} ${cls} ${color}`}>{children}</button>}
function CRMApp({ currentUser, onLogout }){
const [leads,setLeads]=useState([]);const [newLead,setNewLead]=useState(emptyLead);const [selectedLeadId,setSelectedLeadId]=useState(null);const [editDraft,setEditDraft]=useState(null);const [saveMessage,setSaveMessage]=useState("");const [search,setSearch]=useState("");const [stageFilter,setStageFilter]=useState("Todos");const [supplierFilter,setSupplierFilter]=useState("Todos");const [cityFilter,setCityFilter]=useState("Todos");const [proposalFilter,setProposalFilter]=useState("Todos");const [reminderFilter,setReminderFilter]=useState("Todos");const [viewMode,setViewMode]=useState("kanban");const [isEditPanelOpen,setIsEditPanelOpen]=useState(false);const [cloudStatus,setCloudStatus]=useState(cloudEnabled?"Nube conectada":"Modo local");const [lastCloudSync,setLastCloudSync]=useState("");const [workspaceName]=useState(getWorkspaceName());const editSectionRef=useRef(null);
useEffect(()=>{(async()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.leads))setLeads(parsed.leads);if(parsed.selectedLeadId)setSelectedLeadId(parsed.selectedLeadId)}if(cloudEnabled){setCloudStatus("Cargando nube...");const cloudData=await loadWorkspaceFromCloud();if(cloudData&&Array.isArray(cloudData.leads_json)){setLeads(cloudData.leads_json);setCloudStatus("Nube sincronizada");setLastCloudSync(new Date().toLocaleString())}else{setCloudStatus("Nube lista")} } }catch(error){console.error("No pude cargar datos iniciales",error);setCloudStatus("Error nube")} })()},[]);
useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({leads,selectedLeadId}))}catch(error){console.error("No pude guardar datos locales",error)}},[leads,selectedLeadId]);
const exportData=()=>{const blob=new Blob([JSON.stringify({leads},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="mecano-leads-backup.json";a.click();URL.revokeObjectURL(url)};const syncCloud=async()=>{if(!cloudEnabled){alert("Configura Supabase en el archivo .env para activar la nube.");return;}try{setCloudStatus("Sincronizando...");await saveWorkspaceToCloud(leads);setCloudStatus("Nube sincronizada");setLastCloudSync(new Date().toLocaleString())}catch(error){console.error(error);setCloudStatus("Error al sincronizar");alert("No pude sincronizar con la nube. Revisa variables .env y tabla crm_workspaces.");}};
const clearAllData=()=>{const confirmed=window.confirm("¿Seguro que deseas borrar todos los leads guardados en esta app?");if(!confirmed)return;setLeads([]);setSelectedLeadId(null);setEditDraft(null);localStorage.removeItem(STORAGE_KEY)};
const handleImport=async(event)=>{const file=event.target.files?.[0];if(!file)return;try{const arrayBuffer=await file.arrayBuffer();const workbook=XLSX.read(arrayBuffer,{type:"array"});const firstSheet=workbook.Sheets[workbook.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(firstSheet,{defval:""});const imported=parseSpreadsheetRows(rows);if(imported.length){setLeads(imported);setSelectedLeadId(imported[0].id)}else{alert("No se encontraron filas válidas. Revisa que la primera hoja tenga encabezados y datos.")}}catch(error){console.error(error);alert("No pude leer el archivo. Sube el .xlsx original o un .csv bien exportado.")}finally{event.target.value=""}};
const createLead=()=>{if(!newLead.empresa.trim())return;const lead={id:Date.now(),...newLead,valor:Number(newLead.valor||0),probabilidad:Number(newLead.probabilidad||0)};setLeads((prev)=>[lead,...prev]);setSelectedLeadId(lead.id);setNewLead(emptyLead)};
const selectedLead=useMemo(()=>leads.find((l)=>l.id===selectedLeadId)||null,[leads,selectedLeadId]);
useEffect(()=>{if(selectedLead){setEditDraft({...selectedLead});setIsEditPanelOpen(true)}else{setEditDraft(null);setIsEditPanelOpen(false)}},[selectedLeadId]);
const updateLead=(id,patch)=>{setLeads((prev)=>prev.map((lead)=>(lead.id===id?{...lead,...patch}:lead)))};
const saveLeadChanges=()=>{if(!editDraft)return;updateLead(editDraft.id,{...editDraft,valor:Number(editDraft.valor||0),probabilidad:Number(editDraft.probabilidad||0)});setSaveMessage(`Cambios guardados para ${editDraft.empresa}`);setTimeout(()=>setSaveMessage(""),2000)};
const deleteLead=(id)=>{setLeads((prev)=>prev.filter((lead)=>lead.id!==id));if(selectedLeadId===id){setSelectedLeadId(null);setIsEditPanelOpen(false)}};
const openLeadForEdit=(id)=>setSelectedLeadId(id);
const moveStage=(id,direction)=>{setLeads((prev)=>prev.map((lead)=>{if(lead.id!==id)return lead;const idx=STAGES.indexOf(lead.estado);const nextIdx=Math.min(STAGES.length-1,Math.max(0,idx+direction));const nextState=STAGES[nextIdx];return {...lead,estado:nextState,probabilidad:estimateProbability(nextState),perdidoSeguimiento:nextState==="Cerrado perdido"?(lead.perdidoSeguimiento||"Sin gestionar"):lead.perdidoSeguimiento}}))};
const suppliers=useMemo(()=>Array.from(new Set(leads.map((l)=>l.proveedor).filter(Boolean))).sort(),[leads]);
const cities=useMemo(()=>Array.from(new Set(leads.map((l)=>l.ciudad).filter(Boolean))).sort(),[leads]);
const filteredLeads=useMemo(()=>leads.filter((lead)=>{const q=search.trim().toLowerCase();const matchesSearch=!q||[lead.empresa,lead.contacto,lead.proyecto,lead.proveedor,lead.ciudad,lead.cotizacionOdoo].join(" ").toLowerCase().includes(q);const matchesStage=stageFilter==="Todos"||lead.estado===stageFilter;const matchesSupplier=supplierFilter==="Todos"||lead.proveedor===supplierFilter;const matchesCity=cityFilter==="Todos"||lead.ciudad===cityFilter;const matchesProposal=proposalFilter==="Todos"||lead.propuestaEstado===proposalFilter;const bucket=getReminderBucket(lead.fechaSeguimiento);const matchesReminder=reminderFilter==="Todos"||bucket===reminderFilter;return matchesSearch&&matchesStage&&matchesSupplier&&matchesCity&&matchesProposal&&matchesReminder}),[leads,search,stageFilter,supplierFilter,cityFilter,proposalFilter,reminderFilter]);
const kpis=useMemo(()=>{const activos=leads.filter((l)=>!["Cerrado ganado","Cerrado perdido"].includes(l.estado));const cotizaciones=leads.filter((l)=>["Cotización proveedor","Propuesta enviada"].includes(l.estado));const negociacion=leads.filter((l)=>l.estado==="Negociación");const propuestasEnviadas=leads.filter((l)=>l.propuestaEstado==="Enviada"||l.propuestaEstado==="En revisión cliente"||l.propuestaEstado==="Ajustes solicitados");const pipeline=activos.reduce((acc,l)=>acc+Number(l.valor||0),0);const ponderado=activos.reduce((acc,l)=>acc+Number(l.valor||0)*(Number(l.probabilidad||0)/100),0);return {activos:activos.length,cotizaciones:cotizaciones.length,negociacion:negociacion.length,propuestasEnviadas:propuestasEnviadas.length,pipeline,ponderado}},[leads]);
const reminders=useMemo(()=>{const activeLeads=leads.filter((l)=>!["Cerrado ganado","Cerrado perdido"].includes(l.estado));return {vencidos:activeLeads.filter((l)=>getReminderBucket(l.fechaSeguimiento)==="Vencidos"),hoy:activeLeads.filter((l)=>getReminderBucket(l.fechaSeguimiento)==="Hoy"),sieteDias:activeLeads.filter((l)=>getReminderBucket(l.fechaSeguimiento)==="7 dias"),sinFecha:activeLeads.filter((l)=>getReminderBucket(l.fechaSeguimiento)==="Sin fecha")}},[leads]);
const reminderList=useMemo(()=>{const bucketMap={"Vencidos":reminders.vencidos,"Hoy":reminders.hoy,"7 dias":reminders.sieteDias,"Sin fecha":reminders.sinFecha};if(reminderFilter!=="Todos"&&bucketMap[reminderFilter])return bucketMap[reminderFilter];return [...reminders.vencidos,...reminders.hoy,...reminders.sieteDias,...reminders.sinFecha]},[reminders,reminderFilter]);
const callQueue=useMemo(()=>[...leads].filter((l)=>l.clientePorLlamarManual||["Negociación","Propuesta enviada","Cotización proveedor"].includes(l.estado)||l.propuestaEstado==="En revisión cliente"||l.propuestaEstado==="Ajustes solicitados").map((l)=>({...l,priority:calculatePriority(l)})).sort((a,b)=>b.priority-a.priority).slice(0,10),[leads]);
const pipelineBoard=useMemo(()=>{const map={};STAGES.forEach((stage)=>{map[stage]=filteredLeads.filter((l)=>l.estado===stage)});return map},[filteredLeads]);
const maquinasTop=useMemo(()=>{const map={};leads.forEach((l)=>{const key=l.tipoMaquina||l.proyecto;if(!key)return;map[key]=(map[key]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)},[leads]);
const clientesTop=useMemo(()=>[...leads].sort((a,b)=>Number(b.valor||0)-Number(a.valor||0)).slice(0,5),[leads]);
const proveedoresTop=useMemo(()=>{const map={};leads.forEach((l)=>{if(!l.proveedor)return;map[l.proveedor]=(map[l.proveedor]||0)+Number(l.valor||0)});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)},[leads]);
const perdidos=useMemo(()=>leads.filter((l)=>l.estado==="Cerrado perdido"),[leads]);
return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="mx-auto max-w-7xl p-6 space-y-6">
<div className="flex items-center justify-between gap-4 flex-wrap"><div><h1 className="text-3xl font-bold">Mecano Leads CRM</h1><p className="text-slate-600">Versión 5 - CRM online con login de usuarios</p></div><div className="flex flex-wrap items-center gap-2"><div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-600"><div><strong>{currentUser?.email||"Usuario"}</strong></div><div>Workspace: {workspaceName}</div></div><label className="cursor-pointer rounded-xl border bg-white px-4 py-2 text-sm shadow-sm">Importar Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} /></label><ActionButton onClick={exportData}>Exportar respaldo</ActionButton><ActionButton onClick={syncCloud}>Sincronizar nube</ActionButton><ActionButton onClick={clearAllData} danger>Borrar datos locales</ActionButton><ActionButton onClick={onLogout} danger>Cerrar sesión</ActionButton><div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-600"><div><strong>{cloudStatus}</strong></div><div>Workspace: {workspaceName}</div>{lastCloudSync&&<div>Última sync: {lastCloudSync}</div>}</div></div></div>
<div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4"><SmallCard title="Leads activos" value={kpis.activos} /><SmallCard title="Cotizaciones" value={kpis.cotizaciones} /><SmallCard title="Propuestas enviadas" value={kpis.propuestasEnviadas} /><SmallCard title="En negociación" value={kpis.negociacion} /><SmallCard title="Pipeline" value={money(kpis.pipeline)} /><SmallCard title="Pipeline ponderado" value={money(kpis.ponderado)} /></div>
<div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 text-lg font-semibold">Buscador y filtros</div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3"><input className="xl:col-span-2 rounded-xl border px-3 py-2" placeholder="Buscar empresa, proyecto, proveedor, ciudad..." value={search} onChange={(e)=>setSearch(e.target.value)} /><select className="rounded-xl border px-3 py-2" value={stageFilter} onChange={(e)=>setStageFilter(e.target.value)}><option>Todos</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select><select className="rounded-xl border px-3 py-2" value={supplierFilter} onChange={(e)=>setSupplierFilter(e.target.value)}><option>Todos</option>{suppliers.map(s=><option key={s}>{s}</option>)}</select><select className="rounded-xl border px-3 py-2" value={cityFilter} onChange={(e)=>setCityFilter(e.target.value)}><option>Todos</option>{cities.map(c=><option key={c}>{c}</option>)}</select><select className="rounded-xl border px-3 py-2" value={proposalFilter} onChange={(e)=>setProposalFilter(e.target.value)}><option>Todos</option>{PROPOSAL_STATUS.map(s=><option key={s}>{s}</option>)}</select></div></div>
<div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="text-lg font-semibold">Recordatorios</div><div className="flex flex-wrap gap-2">{REMINDER_FILTERS.map((f)=>{const active=reminderFilter===f;const count=f==="Todos"?reminderList.length:f==="Vencidos"?reminders.vencidos.length:f==="Hoy"?reminders.hoy.length:f==="7 dias"?reminders.sieteDias.length:reminders.sinFecha.length;return <button key={f} onClick={()=>setReminderFilter(f)} className={`rounded-full border px-3 py-1 text-sm ${active?reminderBadgeClass(f==="Todos"?"Futuro":f):"bg-white text-slate-700 border-slate-200"}`}>{f} ({count})</button>})}</div></div><div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"><div className="rounded-2xl border border-red-200 bg-red-50 p-3"><div className="text-red-700 font-semibold">Vencidos</div><div className="text-2xl font-bold text-red-700">{reminders.vencidos.length}</div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><div className="text-amber-700 font-semibold">Hoy</div><div className="text-2xl font-bold text-amber-700">{reminders.hoy.length}</div></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-3"><div className="text-blue-700 font-semibold">Próximos 7 días</div><div className="text-2xl font-bold text-blue-700">{reminders.sieteDias.length}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-slate-700 font-semibold">Sin fecha</div><div className="text-2xl font-bold text-slate-700">{reminders.sinFecha.length}</div></div></div><div className="mt-4 space-y-2">{reminderList.length?reminderList.slice(0,12).map((lead)=>{const bucket=getReminderBucket(lead.fechaSeguimiento);return <div key={lead.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer" onClick={()=>openLeadForEdit(lead.id)}><div><div className="font-semibold">{lead.empresa}</div><div className="text-sm text-slate-600">{lead.proximaTarea||lead.proyecto}</div><div className="text-xs text-slate-500">Seguimiento: {lead.fechaSeguimiento||"Sin fecha"}</div></div><span className={`rounded-full border px-3 py-1 text-xs ${reminderBadgeClass(bucket)}`}>{bucket}</span></div>}) : <div className="text-sm text-slate-500">No hay recordatorios para este filtro.</div>}</div></div>
<div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 text-lg font-semibold">Inteligencia Comercial</div><div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm"><div>{maquinasTop.length?maquinasTop.map(([m,c])=><div key={m} className="flex justify-between"><span>{m}</span><span>{c}</span></div>):<div className="text-slate-500">Sin datos.</div>}</div><div>{clientesTop.length?clientesTop.map((c)=><div key={c.id} className="flex justify-between"><span>{c.empresa}</span><span>{money(c.valor)}</span></div>):<div className="text-slate-500">Sin datos.</div>}</div><div>{proveedoresTop.length?proveedoresTop.map(([p,v])=><div key={p} className="flex justify-between"><span>{p}</span><span>{money(v)}</span></div>):<div className="text-slate-500">Sin datos.</div>}</div></div></div>
<div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 text-lg font-semibold">Crear Lead</div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"><input className="rounded-xl border px-3 py-2" placeholder="Empresa" value={newLead.empresa} onChange={(e)=>setNewLead({...newLead,empresa:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Contacto" value={newLead.contacto} onChange={(e)=>setNewLead({...newLead,contacto:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Cargo" value={newLead.cargo} onChange={(e)=>setNewLead({...newLead,cargo:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Responsable inicial" value={newLead.responsableInicial} onChange={(e)=>setNewLead({...newLead,responsableInicial:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Teléfono" value={newLead.telefono} onChange={(e)=>setNewLead({...newLead,telefono:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Email" value={newLead.email} onChange={(e)=>setNewLead({...newLead,email:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Ciudad" value={newLead.ciudad} onChange={(e)=>setNewLead({...newLead,ciudad:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Origen" value={newLead.origen} onChange={(e)=>setNewLead({...newLead,origen:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Proyecto / requerimiento" value={newLead.proyecto} onChange={(e)=>setNewLead({...newLead,proyecto:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Proveedor" value={newLead.proveedor} onChange={(e)=>setNewLead({...newLead,proveedor:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Tipo de máquina" value={newLead.tipoMaquina} onChange={(e)=>setNewLead({...newLead,tipoMaquina:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Capacidad requerida" value={newLead.capacidad} onChange={(e)=>setNewLead({...newLead,capacidad:e.target.value})} /><select className="rounded-xl border px-3 py-2" value={newLead.estado} onChange={(e)=>setNewLead({...newLead,estado:e.target.value,probabilidad:estimateProbability(e.target.value),perdidoSeguimiento:e.target.value==="Cerrado perdido"?"Sin gestionar":newLead.perdidoSeguimiento})}>{STAGES.map((s)=><option key={s}>{s}</option>)}</select><select className="rounded-xl border px-3 py-2" value={newLead.propuestaEstado} onChange={(e)=>setNewLead({...newLead,propuestaEstado:e.target.value})}>{PROPOSAL_STATUS.map((s)=><option key={s}>{s}</option>)}</select><input className="rounded-xl border px-3 py-2" placeholder="Valor USD" value={newLead.valor} onChange={(e)=>setNewLead({...newLead,valor:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Probabilidad %" value={newLead.probabilidad} onChange={(e)=>setNewLead({...newLead,probabilidad:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Cotización Odoo" value={newLead.cotizacionOdoo} onChange={(e)=>setNewLead({...newLead,cotizacionOdoo:e.target.value})} /><input className="rounded-xl border px-3 py-2" placeholder="Próxima tarea" value={newLead.proximaTarea} onChange={(e)=>setNewLead({...newLead,proximaTarea:e.target.value})} /><div className="space-y-1"><label className="text-xs text-slate-500">Fecha seguimiento</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={newLead.fechaSeguimiento} onChange={(e)=>setNewLead({...newLead,fechaSeguimiento:e.target.value})} /></div><div className="space-y-1"><label className="text-xs text-slate-500">Última interacción</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={newLead.ultimaInteraccion} onChange={(e)=>setNewLead({...newLead,ultimaInteraccion:e.target.value})} /></div><label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={newLead.clientePorLlamarManual} onChange={(e)=>setNewLead({...newLead,clientePorLlamarManual:e.target.checked})} /><span>Agregar a clientes para llamar hoy</span></label>{newLead.estado==="Cerrado perdido"&&<><select className="rounded-xl border px-3 py-2" value={newLead.perdidoSeguimiento||"Sin gestionar"} onChange={(e)=>setNewLead({...newLead,perdidoSeguimiento:e.target.value})}>{LOST_FOLLOWUP_STATUS.map((s)=><option key={s}>{s}</option>)}</select><input className="rounded-xl border px-3 py-2" placeholder="Motivo de pérdida" value={newLead.motivoPerdida} onChange={(e)=>setNewLead({...newLead,motivoPerdida:e.target.value})} /></>}<div className="md:col-span-2 xl:col-span-4"><textarea className="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="Notas" value={newLead.notas} onChange={(e)=>setNewLead({...newLead,notas:e.target.value})} /></div><div className="xl:col-span-4 flex justify-end"><ActionButton onClick={createLead}>Guardar Lead</ActionButton></div></div></div>



{isEditPanelOpen && <div className="fixed inset-0 z-40 bg-black/30" onClick={()=>setIsEditPanelOpen(false)} />}
<div ref={editSectionRef} className={`fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l bg-white shadow-2xl transition-transform duration-300 ${isEditPanelOpen ? "translate-x-0" : "translate-x-full"}`}>
  <div className="sticky top-0 border-b bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-lg font-semibold">Edición de lead</div>
        <div className="text-xs text-slate-500"><strong>Fecha seguimiento:</strong> fecha futura para volver a contactar. <strong>Última interacción:</strong> fecha del último contacto real.</div>
      </div>
      <div className="flex gap-2">
        {editDraft&&<ActionButton onClick={saveLeadChanges}>Guardar cambios</ActionButton>}
        <ActionButton onClick={()=>setIsEditPanelOpen(false)}>Cerrar</ActionButton>
      </div>
    </div>
    {saveMessage&&<div className="mt-2 text-sm text-green-600">{saveMessage}</div>}
  </div>
  <div className="p-4">
    {editDraft?<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input className="rounded-xl border px-3 py-2" value={editDraft.empresa} onChange={(e)=>setEditDraft({...editDraft,empresa:e.target.value})} placeholder="Empresa" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.contacto||""} onChange={(e)=>setEditDraft({...editDraft,contacto:e.target.value})} placeholder="Contacto" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.cargo||""} onChange={(e)=>setEditDraft({...editDraft,cargo:e.target.value})} placeholder="Cargo" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.responsableInicial||""} onChange={(e)=>setEditDraft({...editDraft,responsableInicial:e.target.value})} placeholder="Responsable inicial" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.telefono||""} onChange={(e)=>setEditDraft({...editDraft,telefono:e.target.value})} placeholder="Teléfono" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.email||""} onChange={(e)=>setEditDraft({...editDraft,email:e.target.value})} placeholder="Email" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.ciudad||""} onChange={(e)=>setEditDraft({...editDraft,ciudad:e.target.value})} placeholder="Ciudad" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.origen||""} onChange={(e)=>setEditDraft({...editDraft,origen:e.target.value})} placeholder="Origen" />
      <input className="rounded-xl border px-3 py-2 md:col-span-2" value={editDraft.proyecto||""} onChange={(e)=>setEditDraft({...editDraft,proyecto:e.target.value})} placeholder="Proyecto / requerimiento" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.proveedor||""} onChange={(e)=>setEditDraft({...editDraft,proveedor:e.target.value})} placeholder="Proveedor" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.tipoMaquina||""} onChange={(e)=>setEditDraft({...editDraft,tipoMaquina:e.target.value})} placeholder="Tipo de máquina" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.capacidad||""} onChange={(e)=>setEditDraft({...editDraft,capacidad:e.target.value})} placeholder="Capacidad requerida" />
      <select className="rounded-xl border px-3 py-2" value={editDraft.estado} onChange={(e)=>setEditDraft({...editDraft,estado:e.target.value,probabilidad:estimateProbability(e.target.value),perdidoSeguimiento:e.target.value==="Cerrado perdido"?(editDraft.perdidoSeguimiento||"Sin gestionar"):editDraft.perdidoSeguimiento})}>{STAGES.map((s)=><option key={s}>{s}</option>)}</select>
      <select className="rounded-xl border px-3 py-2" value={editDraft.propuestaEstado||"Sin propuesta"} onChange={(e)=>setEditDraft({...editDraft,propuestaEstado:e.target.value})}>{PROPOSAL_STATUS.map((s)=><option key={s}>{s}</option>)}</select>
      <input className="rounded-xl border px-3 py-2" value={editDraft.valor||0} onChange={(e)=>setEditDraft({...editDraft,valor:Number(e.target.value)||0})} placeholder="Valor USD" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.probabilidad||""} onChange={(e)=>setEditDraft({...editDraft,probabilidad:e.target.value})} placeholder="Probabilidad %" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.cotizacionOdoo||""} onChange={(e)=>setEditDraft({...editDraft,cotizacionOdoo:e.target.value})} placeholder="Cotización Odoo" />
      <input className="rounded-xl border px-3 py-2" value={editDraft.proximaTarea||""} onChange={(e)=>setEditDraft({...editDraft,proximaTarea:e.target.value})} placeholder="Próxima tarea" />
      <div className="space-y-1"><label className="text-xs text-slate-500">Fecha seguimiento</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={editDraft.fechaSeguimiento||""} onChange={(e)=>setEditDraft({...editDraft,fechaSeguimiento:e.target.value})} /></div>
      <div className="space-y-1"><label className="text-xs text-slate-500">Última interacción</label><input className="w-full rounded-xl border px-3 py-2" type="date" value={editDraft.ultimaInteraccion||""} onChange={(e)=>setEditDraft({...editDraft,ultimaInteraccion:e.target.value})} /></div>
      <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm md:col-span-2"><input type="checkbox" checked={!!editDraft.clientePorLlamarManual} onChange={(e)=>setEditDraft({...editDraft,clientePorLlamarManual:e.target.checked})} /><span>Agregar a clientes para llamar hoy</span></label>
      {editDraft.estado==="Cerrado perdido"&&<>
        <select className="rounded-xl border px-3 py-2" value={editDraft.perdidoSeguimiento||"Sin gestionar"} onChange={(e)=>setEditDraft({...editDraft,perdidoSeguimiento:e.target.value})}>{LOST_FOLLOWUP_STATUS.map((s)=><option key={s}>{s}</option>)}</select>
        <input className="rounded-xl border px-3 py-2" value={editDraft.motivoPerdida||""} onChange={(e)=>setEditDraft({...editDraft,motivoPerdida:e.target.value})} placeholder="Motivo de pérdida" />
      </>}
      <div className="md:col-span-2"><textarea className="min-h-28 w-full rounded-xl border px-3 py-2" value={editDraft.notas||""} onChange={(e)=>setEditDraft({...editDraft,notas:e.target.value})} placeholder="Notas" /></div>
      <div className="md:col-span-2 flex justify-between">
        <ActionButton danger onClick={()=>deleteLead(editDraft.id)}>Eliminar lead</ActionButton>
        <div className="flex gap-2">
          <ActionButton onClick={saveLeadChanges}>Guardar cambios</ActionButton>
          <ActionButton secondary onClick={()=>setIsEditPanelOpen(false)}>Cerrar panel</ActionButton>
        </div>
      </div>
    </div>:<div className="text-sm text-slate-500">Selecciona un lead para editarlo.</div>}
  </div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 text-lg font-semibold">Clientes para llamar hoy</div><div className="space-y-3">{callQueue.length?callQueue.map((lead)=><div key={lead.id} className="flex justify-between items-center border p-3 rounded-lg cursor-pointer" onClick={()=>openLeadForEdit(lead.id)}><div><div className="font-semibold">{lead.empresa}</div><div className="text-sm text-slate-600">{lead.proyecto}</div><div className="text-xs text-slate-500">{lead.propuestaEstado}</div></div><div className="flex items-center gap-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{lead.estado}</span>{lead.clientePorLlamarManual&&<span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Manual</span>}<div className="text-yellow-600">★ {lead.priority}</div></div></div>):<div className="text-sm text-slate-500">Aún no hay leads listados para llamada.</div>}</div></div><div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 text-lg font-semibold">Presupuestos perdidos</div><div className="space-y-2 text-sm">{perdidos.length?perdidos.slice(0,8).map((lead)=><div key={lead.id} className="flex items-center justify-between gap-2 border rounded-lg p-2 cursor-pointer" onClick={()=>openLeadForEdit(lead.id)}><div><div className="font-medium">{lead.empresa}</div><div className="text-xs text-slate-500">{lead.perdidoSeguimiento||"Sin gestionar"}</div></div><div className="text-xs text-slate-500">{lead.motivoPerdida||"Sin motivo"}</div></div>):<div className="text-sm text-slate-500">No hay presupuestos perdidos registrados.</div>}</div></div></div>
<div className="space-y-4"><div className="flex gap-2"><ActionButton onClick={()=>setViewMode("kanban")} secondary={viewMode==="kanban"}>Kanban</ActionButton><ActionButton onClick={()=>setViewMode("lista")} secondary={viewMode==="lista"}>Lista</ActionButton></div>{viewMode==="kanban"?<div className="grid grid-cols-1 xl:grid-cols-4 gap-4">{STAGES.map((stage)=><div key={stage} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between font-semibold"><span>{stage}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{pipelineBoard[stage].length}</span></div><div className="space-y-2">{pipelineBoard[stage].map((lead)=><div key={lead.id} className="rounded-xl border bg-white p-3 text-sm shadow-sm"><div className="flex items-start justify-between gap-2"><div className="cursor-pointer" onClick={()=>openLeadForEdit(lead.id)}><div className="font-semibold">{lead.empresa}</div><div className="text-slate-500">{lead.proyecto}</div><div className="text-slate-500">{money(lead.valor)}</div><div className="text-xs text-slate-500">{lead.propuestaEstado}</div></div><div className="flex gap-1"><ActionButton small onClick={()=>openLeadForEdit(lead.id)}>Editar</ActionButton><ActionButton small danger onClick={()=>deleteLead(lead.id)}>Eliminar</ActionButton></div></div><div className="mt-3 flex gap-2"><ActionButton small disabled={lead.estado===STAGES[0]} onClick={()=>moveStage(lead.id,-1)}>←</ActionButton><ActionButton small disabled={lead.estado===STAGES[STAGES.length-1]} onClick={()=>moveStage(lead.id,1)}>→</ActionButton></div></div>)}</div></div>)}</div>:<div className="rounded-2xl border bg-white p-4 shadow-sm overflow-x-auto"><div className="mb-4 text-lg font-semibold">Lista de leads</div><table className="min-w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Empresa</th><th className="p-3 text-left">Proyecto</th><th className="p-3 text-left">Proveedor</th><th className="p-3 text-left">Ciudad</th><th className="p-3 text-left">Estado</th><th className="p-3 text-left">Estado propuesta</th><th className="p-3 text-left">Recordatorio</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Cotización</th><th className="p-3 text-left">Acciones</th></tr></thead><tbody>{filteredLeads.map((lead)=>{const bucket=getReminderBucket(lead.fechaSeguimiento);return <tr key={lead.id} className="border-t"><td className="p-3 font-medium cursor-pointer" onClick={()=>openLeadForEdit(lead.id)}>{lead.empresa}</td><td className="p-3">{lead.proyecto}</td><td className="p-3">{lead.proveedor}</td><td className="p-3">{lead.ciudad||"-"}</td><td className="p-3">{lead.estado}</td><td className="p-3">{lead.propuestaEstado}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs ${reminderBadgeClass(bucket)}`}>{bucket}</span></td><td className="p-3">{money(lead.valor)}</td><td className="p-3">{lead.cotizacionOdoo||"-"}</td><td className="p-3"><div className="flex gap-2"><ActionButton small disabled={lead.estado===STAGES[0]} onClick={()=>moveStage(lead.id,-1)}>←</ActionButton><ActionButton small disabled={lead.estado===STAGES[STAGES.length-1]} onClick={()=>moveStage(lead.id,1)}>→</ActionButton><ActionButton small onClick={()=>openLeadForEdit(lead.id)}>Editar</ActionButton><ActionButton small danger onClick={()=>deleteLead(lead.id)}>Eliminar</ActionButton></div></td></tr>})}</tbody></table></div>}</div>
</div></div>}


function AuthScreen({ mode, setMode, onLogin, onRegister, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onRegister(email, password, fullName);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold">CRM Mecano FT</h1>
        <p className="mt-2 text-slate-600">{mode === "login" ? "Ingresa con tu email y contraseña." : "Crea un usuario nuevo para entrar al CRM."}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm text-slate-600">Nombre</label>
              <input className="w-full rounded-xl border px-3 py-2" value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="Nombre del usuario" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-600">Email</label>
            <input className="w-full rounded-xl border px-3 py-2" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required placeholder="usuario@empresa.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Contraseña</label>
            <input className="w-full rounded-xl border px-3 py-2" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required placeholder="********" />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <ActionButton type="submit" secondary disabled={loading}>{loading ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear usuario"}</ActionButton>
        </form>
        <div className="mt-5 text-sm text-slate-600">
          {mode === "login" ? (
            <button onClick={()=>setMode("register")} className="text-blue-700 hover:underline">¿No tienes usuario? Crear cuenta</button>
          ) : (
            <button onClick={()=>setMode("login")} className="text-blue-700 hover:underline">Ya tengo cuenta</button>
          )}
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Para pruebas, en Supabase puedes activar Email y desactivar la confirmación obligatoria por correo.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!cloudEnabled || !supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session || null);
        setAuthLoading(false);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (email, password) => {
    setAuthError("");
    setAuthBusy(true);
    try {
      await signInWithPassword(email, password);
      setAuthMode("login");
    } catch (error) {
      setAuthError(error.message || "No pude iniciar sesión.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (email, password, fullName) => {
    setAuthError("");
    setAuthBusy(true);
    try {
      const result = await signUpWithPassword(email, password, fullName);
      if (!result.session) {
        setAuthError("Usuario creado. Revisa tu correo para confirmar la cuenta o desactiva la confirmación en Supabase para pruebas.");
        setAuthMode("login");
      }
    } catch (error) {
      setAuthError(error.message || "No pude crear el usuario.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
  };

  if (!cloudEnabled) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="rounded-3xl border bg-white p-8 shadow-lg max-w-lg"><h1 className="text-3xl font-bold">CRM Mecano FT</h1><p className="mt-3 text-slate-600">Debes configurar Supabase en el archivo .env antes de usar el login.</p></div></div>;
  }

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="rounded-2xl border bg-white px-6 py-4 shadow">Cargando sesión...</div></div>;
  }

  if (!session) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onLogin={handleLogin} onRegister={handleRegister} loading={authBusy} error={authError} />;
  }

  return <CRMApp currentUser={session.user} onLogout={handleLogout} />;
}
