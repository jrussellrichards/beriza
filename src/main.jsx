import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, ShieldCheck, Upload, Users,
  CreditCard, Search, Settings, Eye, XCircle, ClipboardCheck, Building2,
  Scale, Lock, Activity, Plus, Filter
} from "lucide-react";
import "./styles.css";

const today = new Date("2026-05-11T12:00:00");

const tenant = { id: "tenant-berisa-demo", name: "Mandante Demo Minería Norte", country: "Chile" };

const documentTypes = [
  { id: "vigencia_sociedad", name: "Certificado de vigencia de sociedad", family: "Societaria", criticality: "high", blocksPayment: true, blocksOperation: true, periodicity: "annual", appliesWhen: "Proveedor persona jurídica nacional o extranjero con equivalente legal." },
  { id: "carpeta_tributaria", name: "Carpeta tributaria electrónica", family: "Tributaria", criticality: "medium", blocksPayment: false, blocksOperation: false, periodicity: "quarterly", appliesWhen: "Proveedor nacional con obligaciones tributarias en Chile." },
  { id: "deuda_tgr", name: "Certificado de deuda TGR", family: "Tributaria", criticality: "medium", blocksPayment: false, blocksOperation: false, periodicity: "monthly", appliesWhen: "Proveedor nacional o entidad obligada a acreditar situación fiscal." },
  { id: "f30_1", name: "F30-1 Cumplimiento laboral y previsional", family: "Laboral / Previsional", criticality: "high", blocksPayment: true, blocksOperation: false, periodicity: "monthly", appliesWhen: "Contratista o subcontratista con trabajadores asignados al contrato." },
  { id: "nomina_trabajadores", name: "Nómina mensual de trabajadores", family: "Laboral", criticality: "high", blocksPayment: true, blocksOperation: true, periodicity: "monthly", appliesWhen: "Proveedor con personal en faena o instalaciones del mandante." },
  { id: "seguro_rc", name: "Seguro de responsabilidad civil", family: "Seguros", criticality: "high", blocksPayment: true, blocksOperation: true, periodicity: "annual", appliesWhen: "Contrato con exposición operacional, patrimonial o a terceros." },
  { id: "mutualidad", name: "Certificado mutualidad / ISL", family: "SST", criticality: "high", blocksPayment: true, blocksOperation: true, periodicity: "annual", appliesWhen: "Proveedor con trabajadores dependientes o presencia en faena." },
  { id: "accidentabilidad", name: "Certificado accidentabilidad y siniestralidad", family: "SST", criticality: "medium", blocksPayment: false, blocksOperation: false, periodicity: "annual", appliesWhen: "Proveedor con actividades operacionales, faena o riesgo SST." },
  { id: "ley_20393", name: "Declaración Ley 20.393 / compliance", family: "Compliance", criticality: "medium", blocksPayment: false, blocksOperation: false, periodicity: "annual", appliesWhen: "Todos los proveedores críticos o con relación contractual relevante." },
  { id: "iso_45001", name: "ISO 45001 o sistema SST equivalente", family: "Certificaciones", criticality: "low", blocksPayment: false, blocksOperation: false, periodicity: "annual", appliesWhen: "Exigible si está definido en contrato o bases de licitación." },
];

const vendorsSeed = [
  {
    id: "v-001", legalName: "Constructora Andina SpA", rut: "76.123.456-7", type: "Persona jurídica nacional", service: "Obras civiles y montaje", risk: "high", hasWorkers: true, hasSiteAccess: true, usesSubcontractors: true, contractId: "c-001", site: "Proyecto Mina Norte", amountCLP: 455000000,
    documents: {
      vigencia_sociedad: { status: "approved", expiry: "2026-12-31", period: "2026", version: 2 },
      carpeta_tributaria: { status: "approved", expiry: "2026-07-31", period: "2026-Q2", version: 1 },
      deuda_tgr: { status: "observed", expiry: "2026-05-31", period: "2026-05", version: 1, note: "Falta código verificador legible." },
      f30_1: { status: "approved", expiry: "2026-05-31", period: "2026-04", version: 1 },
      nomina_trabajadores: { status: "approved", expiry: "2026-05-31", period: "2026-04", version: 3 },
      seguro_rc: { status: "approved", expiry: "2026-10-30", period: "2026", version: 1 },
      mutualidad: { status: "approved", expiry: "2026-12-31", period: "2026", version: 1 },
      accidentabilidad: { status: "approved", expiry: "2026-11-30", period: "2026", version: 1 },
      ley_20393: { status: "pending", expiry: null, period: "2026", version: 0 },
      iso_45001: { status: "approved", expiry: "2026-08-30", period: "2026", version: 1 },
    }, findings: []
  },
  {
    id: "v-002", legalName: "Servicios Integrales Patagonia Ltda.", rut: "77.222.333-4", type: "Persona jurídica nacional", service: "Mantención industrial", risk: "medium", hasWorkers: true, hasSiteAccess: true, usesSubcontractors: false, contractId: "c-002", site: "Planta Sur", amountCLP: 128000000,
    documents: {
      vigencia_sociedad: { status: "approved", expiry: "2026-06-15", period: "2026", version: 1 },
      carpeta_tributaria: { status: "approved", expiry: "2026-08-31", period: "2026-Q2", version: 1 },
      deuda_tgr: { status: "approved", expiry: "2026-05-31", period: "2026-05", version: 1 },
      f30_1: { status: "expired", expiry: "2026-04-30", period: "2026-03", version: 1, note: "Debe cargar período abril 2026." },
      nomina_trabajadores: { status: "approved", expiry: "2026-05-31", period: "2026-04", version: 1 },
      seguro_rc: { status: "approved", expiry: "2026-09-30", period: "2026", version: 1 },
      mutualidad: { status: "approved", expiry: "2026-12-31", period: "2026", version: 1 },
      accidentabilidad: { status: "approved", expiry: "2026-12-31", period: "2026", version: 1 },
      ley_20393: { status: "approved", expiry: "2026-12-31", period: "2026", version: 1 },
      iso_45001: { status: "not_required", expiry: null, period: null, version: 0 },
    }, findings: [{ id: "h-001", severity: "high", title: "F30-1 vencido", status: "open" }]
  },
  {
    id: "v-003", legalName: "TechSupply Global Inc.", rut: "EXT-998877", type: "Proveedor extranjero", service: "Suministro de sensores IoT", risk: "low", hasWorkers: false, hasSiteAccess: false, usesSubcontractors: false, contractId: "c-003", site: "Sin presencia en faena", amountCLP: 68000000,
    documents: {
      vigencia_sociedad: { status: "approved", expiry: "2027-01-15", period: "2026", version: 1 },
      carpeta_tributaria: { status: "not_required", expiry: null, period: null, version: 0 },
      deuda_tgr: { status: "not_required", expiry: null, period: null, version: 0 },
      f30_1: { status: "not_required", expiry: null, period: null, version: 0 },
      nomina_trabajadores: { status: "not_required", expiry: null, period: null, version: 0 },
      seguro_rc: { status: "approved", expiry: "2026-07-20", period: "2026", version: 1 },
      mutualidad: { status: "not_required", expiry: null, period: null, version: 0 },
      accidentabilidad: { status: "not_required", expiry: null, period: null, version: 0 },
      ley_20393: { status: "approved", expiry: "2026-12-31", period: "2026", version: 1 },
      iso_45001: { status: "not_required", expiry: null, period: null, version: 0 },
    }, findings: []
  }
];

const paymentClaimsSeed = [
  { id: "ep-001", vendorId: "v-001", contractId: "c-001", period: "2026-04", amountCLP: 84500000, technicalApproval: true, requestedAt: "2026-05-08" },
  { id: "ep-002", vendorId: "v-002", contractId: "c-002", period: "2026-04", amountCLP: 22600000, technicalApproval: true, requestedAt: "2026-05-09" },
  { id: "ep-003", vendorId: "v-003", contractId: "c-003", period: "2026-04", amountCLP: 18200000, technicalApproval: true, requestedAt: "2026-05-10" },
];

const auditSeed = [
  { id: 1, at: "2026-05-11 09:10", actor: "Sistema", action: "Recalculó cumplimiento", target: "Constructora Andina SpA" },
  { id: 2, at: "2026-05-11 09:14", actor: "Auditor HSE", action: "Aprobó mutualidad", target: "Servicios Integrales Patagonia Ltda." },
  { id: 3, at: "2026-05-11 10:02", actor: "Motor de pagos", action: "Bloqueó EP por F30-1 vencido", target: "EP-002" },
  { id: 4, at: "2026-05-11 10:18", actor: "Proveedor", action: "Cargó carpeta tributaria", target: "Constructora Andina SpA" },
  { id: 5, at: "2026-05-11 11:30", actor: "Administrador", action: "Actualizó regla de alerta a 15 días", target: "Matriz minería" },
];

function currency(value) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value); }
function daysTo(expiry) { if (!expiry) return null; const d = new Date(`${expiry}T12:00:00`); return Math.ceil((d.getTime() - today.getTime()) / 86400000); }
function isRequired(vendor, docType) {
  if (docType.id === "f30_1" || docType.id === "nomina_trabajadores") return vendor.hasWorkers;
  if (docType.id === "mutualidad" || docType.id === "accidentabilidad" || docType.id === "iso_45001") return vendor.hasSiteAccess || vendor.risk === "high";
  if (docType.id === "carpeta_tributaria" || docType.id === "deuda_tgr") return vendor.type !== "Proveedor extranjero";
  return true;
}
function labelForStatus(status) { return ({ approved: "Aprobado", pending: "Pendiente", observed: "Observado", rejected: "Rechazado", expired: "Vencido", not_required: "No requerido", uploaded: "Cargado", review: "En revisión" }[status] || status); }
function evaluateVendor(vendor) {
  const rows = documentTypes.filter((d) => isRequired(vendor, d)).map((docType) => {
    const doc = vendor.documents[docType.id] || { status: "pending", expiry: null, version: 0 };
    const left = daysTo(doc.expiry);
    const expiredByDate = left !== null && left < 0;
    const status = expiredByDate && doc.status === "approved" ? "expired" : doc.status;
    return { docType, doc: { ...doc, status }, daysLeft: left };
  });
  const highFailures = rows.filter((r) => r.docType.criticality === "high" && ["pending", "expired", "rejected", "observed"].includes(r.doc.status));
  const mediumFailures = rows.filter((r) => r.docType.criticality === "medium" && ["pending", "expired", "rejected", "observed"].includes(r.doc.status));
  const warnings = rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 15);
  const openCriticalFindings = vendor.findings.filter((f) => f.status === "open" && f.severity === "high");
  let status = "approved";
  if (highFailures.length > 0 || openCriticalFindings.length > 0) status = "blocked";
  else if (mediumFailures.length > 0 || warnings.length > 0) status = "conditional";
  const approvedCount = rows.filter((r) => r.doc.status === "approved").length;
  const compliance = rows.length === 0 ? 100 : Math.round((approvedCount / rows.length) * 100);
  const riskScore = Math.min(100, (vendor.risk === "high" ? 35 : vendor.risk === "medium" ? 20 : 8) + (vendor.hasWorkers ? 15 : 0) + (vendor.hasSiteAccess ? 15 : 0) + highFailures.length * 12 + mediumFailures.length * 6 + openCriticalFindings.length * 15);
  return { status, rows, highFailures, mediumFailures, warnings, compliance, riskScore, openCriticalFindings };
}
function evaluatePayment(payment, vendors) {
  const vendor = vendors.find((v) => v.id === payment.vendorId);
  const assessment = evaluateVendor(vendor);
  const blockers = [];
  const conditionals = [];
  if (!payment.technicalApproval) blockers.push("Servicio sin recepción conforme técnica.");
  if (assessment.status === "blocked") blockers.push("Proveedor bloqueado por incumplimientos críticos.");
  assessment.rows.forEach(({ docType, doc }) => {
    if (docType.blocksPayment && ["pending", "expired", "rejected", "observed"].includes(doc.status)) blockers.push(`${docType.name}: ${labelForStatus(doc.status)}.`);
    else if (!docType.blocksPayment && ["pending", "expired", "rejected", "observed"].includes(doc.status)) conditionals.push(`${docType.name}: ${labelForStatus(doc.status)}.`);
  });
  if (assessment.openCriticalFindings.length > 0) blockers.push("Hallazgo crítico abierto.");
  if (blockers.length > 0) return { decision: "blocked", blockers, conditionals, vendor };
  if (conditionals.length > 0) return { decision: "conditional", blockers, conditionals, vendor };
  return { decision: "released", blockers, conditionals, vendor };
}
function statusClasses(status) { return ({ approved: "green", released: "green", conditional: "yellow", blocked: "red", pending: "gray", observed: "yellow", rejected: "red", expired: "red", not_required: "gray" }[status] || "gray"); }
function StatusPill({ status, children }) { return <span className={`pill ${statusClasses(status)}`}>{children || labelForStatus(status)}</span>; }
function MetricCard({ icon: Icon, label, value, helper }) { return <div className="card metric"><div><p className="muted small">{label}</p><p className="metric-value">{value}</p>{helper && <p className="muted mini">{helper}</p>}</div><div className="iconbox"><Icon size={22} /></div></div>; }

function Sidebar({ role, setRole, view, setView }) {
  const menu = [
    { id: "dashboard", label: "Mandante", icon: Building2 }, { id: "supplier", label: "Proveedor", icon: Upload },
    { id: "payments", label: "Estados de pago", icon: CreditCard }, { id: "audit", label: "Auditoría", icon: ClipboardCheck }, { id: "admin", label: "Administrador", icon: Settings }
  ];
  return <aside className="sidebar"><div className="brand"><div className="logo"><ShieldCheck size={22}/></div><div><h1>Berisa</h1><p>Compliance 360</p></div></div><div className="rolebox"><p>Rol activo</p><select value={role} onChange={(e) => setRole(e.target.value)}><option>Mandante</option><option>Proveedor</option><option>Auditor</option><option>Administrador</option></select></div><nav>{menu.map((item)=>{ const Icon=item.icon; return <button key={item.id} onClick={()=>setView(item.id)} className={view===item.id ? "active" : ""}><Icon size={18}/>{item.label}</button>;})}</nav><div className="tenant"><p>Ambiente</p><strong>{tenant.name}</strong><span>SaaS multiempresa · Demo funcional</span></div></aside>;
}
function Topbar({ search, setSearch, view }) {
  const titles = { dashboard: "Torre de control del mandante", supplier: "Portal autogestionado del proveedor", payments: "Motor de estados de pago", audit: "Auditoría y trazabilidad", admin: "Administración del módulo" };
  return <header className="topbar"><div><p className="overline">Berisa Compliance 360</p><h2>{titles[view]}</h2></div><div className="searchrow"><div className="search"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar proveedor, RUT, contrato..." /></div><button className="primary"><Plus size={16}/>Nuevo</button></div></header>;
}
function DashboardMandante({ vendors, payments, setSelectedVendorId }) {
  const assessments = vendors.map((v)=>({vendor:v, ...evaluateVendor(v)}));
  const paymentEvals = payments.map((p)=>({p, ...evaluatePayment(p, vendors)}));
  const blocked = assessments.filter((a)=>a.status==="blocked").length;
  const conditional = assessments.filter((a)=>a.status==="conditional").length;
  const approved = assessments.filter((a)=>a.status==="approved").length;
  const blockedPayments = paymentEvals.filter((r)=>r.decision==="blocked");
  const retainedAmount = blockedPayments.reduce((sum, e)=>sum+e.p.amountCLP,0);
  return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="content"><div className="grid four"><MetricCard icon={Users} label="Proveedores" value={vendors.length} helper={`${approved} aprobados · ${conditional} condicionados · ${blocked} bloqueados`} /><MetricCard icon={FileText} label="Documentos críticos observados" value={assessments.reduce((s,a)=>s+a.highFailures.length,0)} helper="Bloquean operación o pago según regla"/><MetricCard icon={CreditCard} label="Estados de pago bloqueados" value={blockedPayments.length} helper={`Monto referencial: ${currency(retainedAmount)}`}/><MetricCard icon={Activity} label="Riesgo promedio" value={`${Math.round(assessments.reduce((s,a)=>s+a.riskScore,0)/assessments.length)}`} helper="Score 0 a 100"/></div><div className="grid main"><div className="card table-card"><div className="card-head"><div><h3>Proveedores por cumplimiento</h3><p>Vista ejecutiva para toma de decisiones.</p></div><button className="secondary"><Filter size={16}/>Filtrar</button></div><table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Cumplimiento</th><th>Riesgo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{assessments.map((a)=><tr key={a.vendor.id}><td><strong>{a.vendor.legalName}</strong><span>{a.vendor.rut} · {a.vendor.site}</span></td><td>{a.vendor.service}</td><td><div className="bar"><i style={{width:`${a.compliance}%`}}></i></div><span>{a.compliance}%</span></td><td><strong>{a.riskScore}/100</strong></td><td><StatusPill status={a.status}>{a.status==="approved"?"Aprobado":a.status==="conditional"?"Condicionado":"Bloqueado"}</StatusPill></td><td><button className="secondary" onClick={()=>setSelectedVendorId(a.vendor.id)}><Eye size={15}/>Ver</button></td></tr>)}</tbody></table></div><div className="card"><h3>Alertas críticas</h3><div className="alerts">{assessments.flatMap((a)=>a.highFailures.map((f)=>({vendor:a.vendor,f}))).slice(0,6).map((item,i)=><div className="alert red" key={i}><AlertTriangle size={18}/><div><strong>{item.f.docType.name}</strong><span>{item.vendor.legalName} · {labelForStatus(item.f.doc.status)}</span></div></div>)}{assessments.every((a)=>a.highFailures.length===0)&&<p className="muted">No existen alertas críticas.</p>}</div></div></div></motion.div>;
}
function SupplierPortal({ vendor, onUploadDemo }) {
  const assessment = evaluateVendor(vendor);
  return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="content"><div className="card hero"><div><p className="muted">Portal proveedor</p><h3>{vendor.legalName}</h3><p className="muted">{vendor.rut} · {vendor.type} · {vendor.service}</p></div><StatusPill status={assessment.status}>{assessment.status==="approved"?"Proveedor aprobado":assessment.status==="conditional"?"Proveedor condicionado":"Proveedor bloqueado"}</StatusPill><div className="grid three stats"><div><span>Cumplimiento documental</span><strong>{assessment.compliance}%</strong></div><div><span>Riesgo</span><strong>{assessment.riskScore}/100</strong></div><div><span>Acciones pendientes</span><strong>{assessment.highFailures.length+assessment.mediumFailures.length}</strong></div></div></div><div className="card"><div className="card-head"><div><h3>Checklist documental inteligente</h3><p>Solo se muestran documentos aplicables según perfil, contrato y faena.</p></div><button className="primary" onClick={onUploadDemo}><Upload size={16}/>Simular carga</button></div><div className="doc-grid">{assessment.rows.map(({docType,doc,daysLeft})=><div className="doc" key={docType.id}><div className="doc-top"><div><strong>{docType.name}</strong><span>{docType.family} · {docType.periodicity}</span></div><StatusPill status={doc.status}/></div><p>{docType.appliesWhen}</p><div className="doc-foot"><span>Vence: {doc.expiry||"No cargado"}</span><span>{daysLeft===null?"—":daysLeft<0?`${Math.abs(daysLeft)} días vencido`:`${daysLeft} días`}</span></div>{doc.note&&<div className="note">{doc.note}</div>}</div>)}</div></div></motion.div>;
}
function PaymentsView({ payments, vendors }) {
  const evaluations = payments.map((p)=>({payment:p, ...evaluatePayment(p, vendors)}));
  return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="content"><div className="grid three"><MetricCard icon={CheckCircle2} label="Liberados" value={evaluations.filter((e)=>e.decision==="released").length} helper="Cumplen reglas críticas"/><MetricCard icon={Clock} label="Condicionados" value={evaluations.filter((e)=>e.decision==="conditional").length} helper="Faltas no críticas"/><MetricCard icon={XCircle} label="Bloqueados" value={evaluations.filter((e)=>e.decision==="blocked").length} helper="Incumplimiento crítico"/></div><div className="card"><div className="card-head left"><h3>Evaluación automática de estados de pago</h3><p>El motor evalúa proveedor, contrato, recepción conforme, documentos críticos, F30-1, seguros, permisos y hallazgos.</p></div><div className="payments">{evaluations.map((e)=><div className="payment" key={e.payment.id}><div className="payment-head"><div><strong>{e.payment.id} · {e.vendor.legalName}</strong><span>Contrato {e.payment.contractId} · Período {e.payment.period} · {currency(e.payment.amountCLP)}</span></div><StatusPill status={e.decision}>{e.decision==="released"?"Liberado automático":e.decision==="conditional"?"Liberado condicionado":"Bloqueado"}</StatusPill></div>{e.blockers.length>0&&<div className="reason red"><strong>Motivos de bloqueo</strong><ul>{e.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}{e.conditionals.length>0&&e.blockers.length===0&&<div className="reason yellow"><strong>Condiciones pendientes</strong><ul>{e.conditionals.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}{e.blockers.length===0&&e.conditionals.length===0&&<div className="reason green">Pago liberado: no existen incumplimientos críticos ni condiciones pendientes.</div>}</div>)}</div></div></motion.div>;
}
function AuditView({ vendors }) { return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="content"><div className="grid four"><MetricCard icon={ClipboardCheck} label="Eventos auditables" value={auditSeed.length} helper="Bitácora append-only"/><MetricCard icon={AlertTriangle} label="Hallazgos abiertos" value={vendors.flatMap((v)=>v.findings).filter((f)=>f.status==="open").length} helper="Priorizados por severidad"/><MetricCard icon={Lock} label="Excepciones" value="0" helper="Sin excepciones activas"/><MetricCard icon={Scale} label="Pagos auditables" value="3" helper="Con decisión trazable"/></div><div className="card"><div className="card-head left"><h3>Bitácora de auditoría</h3><p>Registro de acciones críticas, reglas aplicadas y evidencia de decisión.</p></div>{auditSeed.map((item)=><div className="audit" key={item.id}><div className="iconbox"><ClipboardCheck size={18}/></div><div><strong>{item.action}</strong><p>{item.actor} · {item.target}</p><span>{item.at}</span></div></div>)}</div></motion.div>; }
function AdminView() { return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="content"><div className="grid four"><MetricCard icon={Building2} label="Mandantes" value="1" helper="Ambiente demo"/><MetricCard icon={FileText} label="Tipos documentales" value={documentTypes.length} helper="Catálogo activo"/><MetricCard icon={ShieldCheck} label="Reglas activas" value="5" helper="Parametrizables"/><MetricCard icon={Lock} label="Seguridad" value="MFA" helper="RBAC + logs"/></div><div className="grid two"><div className="card"><h3>Catálogo documental</h3><div className="list">{documentTypes.map((d)=><div className="listitem" key={d.id}><div><strong>{d.name}</strong><span>{d.family} · Criticidad {d.criticality}</span></div><StatusPill status={d.blocksPayment?"blocked":"approved"}>{d.blocksPayment?"Bloquea pago":"No bloquea pago"}</StatusPill></div>)}</div></div><div className="card"><h3>Reglas base del motor</h3><div className="rules">{["Si proveedor tiene trabajadores asignados, exigir F30-1 mensual.","Si documento crítico está vencido, bloquear estado de pago.","Si documento vence en 15 días, notificar al proveedor.","Si hay observación no crítica, permitir liberación condicionada.","Si se confirma falsedad documental, suspender proveedor."].map((rule,i)=><div key={i}>{rule}</div>)}</div></div></div></motion.div>; }

function App() {
  const [vendors, setVendors] = useState(vendorsSeed);
  const [payments] = useState(paymentClaimsSeed);
  const [view, setView] = useState("dashboard");
  const [role, setRole] = useState("Mandante");
  const [search, setSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("v-001");
  const filteredVendors = useMemo(()=>{ const q=search.trim().toLowerCase(); if(!q) return vendors; return vendors.filter((v)=>[v.legalName,v.rut,v.service,v.site,v.contractId].join(" ").toLowerCase().includes(q)); },[vendors,search]);
  const selectedVendor = vendors.find((v)=>v.id===selectedVendorId)||vendors[0];
  function onUploadDemo(){ setVendors((prev)=>prev.map((v)=> v.id!==selectedVendor.id ? v : { ...v, documents: { ...v.documents, ley_20393: { status:"approved", expiry:"2026-12-31", period:"2026", version:(v.documents.ley_20393?.version||0)+1 }, deuda_tgr: v.documents.deuda_tgr?.status==="observed" ? { status:"approved", expiry:"2026-05-31", period:"2026-05", version:2 } : v.documents.deuda_tgr } })); }
  return <div className="app"><Sidebar role={role} setRole={setRole} view={view} setView={setView}/><main><Topbar search={search} setSearch={setSearch} view={view}/>{view==="dashboard"&&<DashboardMandante vendors={filteredVendors} payments={payments} setSelectedVendorId={(id)=>{setSelectedVendorId(id);setView("supplier");}}/>}{view==="supplier"&&<SupplierPortal vendor={selectedVendor} onUploadDemo={onUploadDemo}/>} {view==="payments"&&<PaymentsView payments={payments} vendors={vendors}/>} {view==="audit"&&<AuditView vendors={vendors}/>} {view==="admin"&&<AdminView/>}</main></div>;
}

createRoot(document.getElementById("root")).render(<App />);
