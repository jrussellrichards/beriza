import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  HouseIcon as House,
  BuildingsIcon as Buildings,
  UsersIcon as Users,
  ShieldCheckIcon as ShieldCheck,
  ChartLineUpIcon as ChartLineUp,
  FileTextIcon as FileText,
  EyeIcon as Eye,
  LockIcon as Lock,
  BellIcon as Bell,
  MagnifyingGlassIcon as MagnifyingGlass,
  PlusIcon as Plus,
  WarningIcon as Warning,
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle,
  InfoIcon as Info,
  TrashIcon as Trash,
  HardHatIcon as HardHat,
  LeafIcon as Leaf,
  FactoryIcon as Factory,
  CertificateIcon as Certificate,
  ArrowsCounterClockwiseIcon as ArrowsCounterClockwise,
  LightningIcon as Lightning,
  AnchorIcon as Anchor,
  CaretRightIcon as CaretRight,
  SealCheckIcon as SealCheck,
  CalendarBlankIcon as CalendarBlank,
  MapPinIcon as MapPin,
  HashIcon as Hash,
  RobotIcon as Robot,
  KeyIcon as Key,
  CurrencyDollarIcon as CurrencyDollar,
  HandshakeIcon as Handshake,
  IdentificationCardIcon as IdentificationCard,
  SirenIcon as Siren,
  BiohazardIcon as Biohazard,
  UserCircleIcon as UserCircle,
  BriefcaseIcon as Briefcase,
  MedalMilitaryIcon as MedalMilitary,
  DropHalfIcon as DropHalf,
  DetectiveIcon as Detective,
  DatabaseIcon as Database
} from "@phosphor-icons/react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import "./styles.css";

// ═══════════════════════════════════════════════════════════════════
// DATA SEEDS — BERISA Business Model
// ═══════════════════════════════════════════════════════════════════

const STAGES = ["Prospecto","Contacto","Propuesta","Negociación","Adjudicado","Cerrado"];
const ICE_LABELS = { 1:"ICE-1 Sin Faena", 2:"ICE-2 Faena", 3:"ICE-3 Permanente", 4:"ICE-4 Crítico" };

const seedOpportunities = [
  { id:"op-001", name:"Parque Eólico Loa", source:"CNE/SEIA", capex:120, stage:"Propuesta",    region:"Antofagasta", mandante:"Enel Chile", priority:"Alta", services:["HSE","Ambiental"] },
  { id:"op-002", name:"Puente Chacao II",  source:"MOP",      capex:85,  stage:"Negociación",  region:"Los Lagos",   mandante:"MOP",        priority:"Alta", services:["Obras Civiles","HSE"] },
  { id:"op-003", name:"Mina Norte Amp.",   source:"SEIA",     capex:45,  stage:"Contacto",     region:"Atacama",     mandante:"Codelco",    priority:"Media",services:["Montaje","Ambiental"] },
  { id:"op-004", name:"Planta GNL Quín",  source:"Mercado",  capex:200, stage:"Prospecto",    region:"Valparaíso",  mandante:"Enap",       priority:"Alta", services:["Ingeniería","HSE"] },
  { id:"op-005", name:"Ruta 5 Sur Km760", source:"Conc.",    capex:180, stage:"Adjudicado",   region:"Coquimbo",    mandante:"Costanera",  priority:"Alta", services:["Obras Civiles"] },
  { id:"op-006", name:"Planta Litio Ata", source:"SEIA",     capex:65,  stage:"Cerrado",      region:"Atacama",     mandante:"SQM",        priority:"Baja", services:["Ambiental","Legal"] },
];

const seedVendors = [
  { id:"v-001", name:"Constructora Andina SpA",          rut:"76.123.456-7", type:"Nacional", service:"Obras civiles y montaje", region:"Atacama",     iceLevel:4, score:88, compliance:"Conforme",   daysUntilExpiry:45,  workers:142, incidents:0 },
  { id:"v-002", name:"Servicios Patagonia Ltda.",        rut:"77.222.333-4", type:"Nacional", service:"Mantención industrial",   region:"Los Lagos",   iceLevel:3, score:74, compliance:"Observado",  daysUntilExpiry:8,   workers:63,  incidents:1 },
  { id:"v-003", name:"TechSupply Global Inc.",           rut:"EXT-998877",   type:"Extranjero",service:"Suministro sensores IoT", region:"RM",          iceLevel:2, score:82, compliance:"Conforme",   daysUntilExpiry:180, workers:0,   incidents:0 },
  { id:"v-004", name:"Ingeniería Hidrológica Sur SpA",   rut:"77.888.222-1", type:"Nacional", service:"Estudios ambientales",    region:"Biobío",      iceLevel:1, score:91, compliance:"Conforme",   daysUntilExpiry:90,  workers:24,  incidents:0 },
  { id:"v-005", name:"Montajes El Teniente Ltda.",       rut:"76.555.991-K", type:"Nacional", service:"Montaje mecánico pesado", region:"O'Higgins",   iceLevel:4, score:79, compliance:"No Conforme",daysUntilExpiry:0,   workers:210, incidents:3 },
];

const seedIncidents = [
  { id:"inc-01", date:"2026-04-10", cat:"Leve",       desc:"Torcedura de tobillo en tránsito",             workers:1, daysLost:2,  code:"AT-2026-0032", vendor:"v-001" },
  { id:"inc-02", date:"2026-05-02", cat:"Grave",      desc:"Fractura de radio en caída a nivel",           workers:1, daysLost:35, code:"AT-2026-0045", vendor:"v-002" },
  { id:"inc-03", date:"2026-05-18", cat:"Leve",       desc:"Corte superficial con herramienta manual",     workers:1, daysLost:1,  code:"AT-2026-0051", vendor:"v-005" },
  { id:"inc-04", date:"2026-06-01", cat:"Accidente",  desc:"Atrapamiento parcial en correa transportadora",workers:1, daysLost:60, code:"AT-2026-0064", vendor:"v-005" },
];

const seedRisks = [
  { id:"r-1", prob:4, sev:4, name:"Caída de altura — montaje andamios",       control:"Arnés doble cabo + línea de vida certificada.", category:"Crítico" },
  { id:"r-2", prob:2, sev:5, name:"Contacto con línea eléctrica subestación", control:"Protocolo LOTO + guantes dieléctricos.",         category:"Alto" },
  { id:"r-3", prob:3, sev:2, name:"Exposición a ruido ocupacional molienda",  control:"Protección auditiva sobre 85 dBA.",             category:"Medio" },
  { id:"r-4", prob:1, sev:4, name:"Fuga de combustible — estanque diésel",    control:"Kit antiderrame + bunding certificado.",         category:"Alto" },
  { id:"r-5", prob:3, sev:3, name:"Golpe por materiales en manipulación",     control:"Procedimiento JHA + EPP manos.",                category:"Medio" },
];

const seedRca = [
  { id:"rca-01", condition:"Monitoreo mensual nivel freático",           status:"Conforme",   date:"2026-05-15" },
  { id:"rca-02", condition:"Barreras acústicas perimetrales",             status:"Observada",  date:"2026-05-20" },
  { id:"rca-03", condition:"Informe semestral avifauna a SMA",           status:"Vencida",    date:"2026-04-30" },
  { id:"rca-04", condition:"Reforestación compensatoria 2ha",            status:"Conforme",   date:"2026-06-01" },
];

const seedRespel = [
  { id:"res-01", type:"Aceites lubricantes usados",     kg:350, center:"EcoValor Lampa",    cert:"C-998822", date:"2026-04-22" },
  { id:"res-02", type:"Baterías plomo-ácido",           kg:120, center:"Recimat Calama",    cert:"C-998845", date:"2026-05-10" },
  { id:"res-03", type:"Envases contaminados",           kg:85,  center:"Geocycle Concón",   cert:"C-998901", date:"2026-05-29" },
];

const seedAudit = [
  { time:"09:14", actor:"admin@berisa.cl",      action:"Alta proveedor",   target:"Constructora Andina SpA",     role:"Admin" },
  { time:"10:02", actor:"mandante1@enel.cl",    action:"Aprobación doc.",  target:"F30-1 Andina — Mar 2026",    role:"Mandante" },
  { time:"11:30", actor:"vendor1@andina.cl",    action:"Subida documento", target:"Póliza resp. civil 2026",    role:"Proveedor" },
  { time:"14:15", actor:"auditor@berisa.cl",    action:"Hallazgo creado",  target:"Patagonia — F30-1 vencido", role:"Auditor" },
  { time:"15:48", actor:"mandante2@mop.cl",     action:"Filtro aplicado",  target:"Vista proveedores ICE-4",    role:"Mandante" },
  { time:"16:20", actor:"admin@berisa.cl",      action:"Plan actualizado", target:"Plan Profesional → Business",role:"Admin" },
];

const trendData = [
  { mes:"Ene", contratos:4, proveedores:8,  incidentes:2 },
  { mes:"Feb", contratos:6, proveedores:11, incidentes:1 },
  { mes:"Mar", contratos:5, proveedores:14, incidentes:3 },
  { mes:"Abr", contratos:9, proveedores:14, incidentes:2 },
  { mes:"May", contratos:11,proveedores:17, incidentes:4 },
  { mes:"Jun", contratos:8, proveedores:18, incidentes:1 },
];

const compliancePie = [
  { name:"Conforme",    value:63, color:"#22C55E" },
  { name:"Observado",   value:22, color:"#E4B44A" },
  { name:"No Conforme", value:15, color:"#E05252" },
];

const hseBar = [
  { cat:"AT Leves",     val:3, fill:"#E4B44A" },
  { cat:"AT Graves",    val:1, fill:"#E05252" },
  { cat:"Acc. SEIA",   val:0, fill:"#22C55E" },
  { cat:"NCR Abiertas", val:4, fill:"#3BBFAE" },
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const fmt = (n) => new Intl.NumberFormat("es-CL").format(n);
const mmusd = (v) => `US$ ${v}M`;
const scoreColor = (s) => s >= 85 ? "#16A34A" : s >= 70 ? "#C9972B" : "#C53030";
const complianceClass = (s) => s === "Conforme" ? "green" : s === "Observado" ? "yellow" : s === "No Conforme" ? "red" : "slate";
const catClass = (c) => ({ "Leve":"yellow", "Grave":"red", "Accidente":"red", "Crítico":"red", "Alto":"yellow", "Medio":"teal" }[c] || "slate");
const iceColor = (l) => ({ 1:"slate", 2:"blue", 3:"teal", 4:"yellow" }[l] || "slate");
const stages = STAGES;

// ═══════════════════════════════════════════════════════════════════
// PLAN GATE (simulación de roles y planes)
// ═══════════════════════════════════════════════════════════════════

function PlanGate({ plan, required, children }) {
  const rank = { Starter:1, Profesional:2, Business:3, Enterprise:4 };
  const ok = (rank[plan] || 1) >= (rank[required] || 99);
  if (ok) return children;
  return (
    <div style={{ position:"relative", minHeight:240 }}>
      <div style={{ filter:"blur(3px)", pointerEvents:"none", userSelect:"none", opacity:0.4 }}>
        {children}
      </div>
      <div className="plan-gate-overlay">
        <div className="lock-panel">
          <div className="lock-icon">
            <Lock size={28} weight="duotone" />
          </div>
          <div className="lock-title">Plan {required} requerido</div>
          <div className="lock-desc">
            Esta funcionalidad está disponible desde el plan <strong>{required}</strong>.
            Mejora tu suscripción para desbloquearla.
          </div>
          <button className="btn btn-gold" style={{ width:"100%" }}>
            <Lightning size={15} weight="fill" /> Ver planes disponibles
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NAV CONFIG
// ═══════════════════════════════════════════════════════════════════

const ROLE_VIEWS = {
  Mandante: [
    { id:"dashboard",    label:"Dashboard",         icon:House,         group:"General" },
    { id:"oportunidades",label:"Oportunidades",      icon:Handshake,     group:"General" },
    { id:"proveedores",  label:"Directorio Proveedores",icon:Buildings,  group:"Contratistas" },
    { id:"matching",     label:"Matching Engine",    icon:Robot,         group:"Contratistas", plan:"Profesional" },
    { id:"hse",          label:"Gestión HSE",        icon:HardHat,       group:"Cumplimiento" },
    { id:"ambiental",    label:"Cumplimiento Ambiental",icon:Leaf,        group:"Cumplimiento" },
    { id:"riesgos",      label:"Mapa de Riesgos",    icon:Warning,       group:"Cumplimiento" },
    { id:"auditoria",    label:"Auditoría",           icon:Detective,     group:"Plataforma" },
  ],
  Proveedor: [
    { id:"dashboard",    label:"Dashboard",          icon:House,         group:"General" },
    { id:"mi-perfil",    label:"Mi Perfil",          icon:IdentificationCard,group:"Mi Empresa" },
    { id:"documentos",   label:"Mis Documentos",     icon:FileText,      group:"Mi Empresa" },
    { id:"contratos",    label:"Mis Contratos",      icon:Briefcase,     group:"Operación" },
    { id:"hse",          label:"Mis Incidentes HSE", icon:HardHat,       group:"Operación" },
    { id:"cumplimiento", label:"Cumplimiento",        icon:ShieldCheck,   group:"Operación" },
  ],
  Admin: [
    { id:"dashboard",    label:"Dashboard",          icon:House,         group:"General" },
    { id:"mandantes",    label:"Mandantes",          icon:Buildings,     group:"CRM" },
    { id:"proveedores",  label:"Proveedores",        icon:Users,         group:"CRM" },
    { id:"planes",       label:"Planes SaaS",        icon:CurrencyDollar,group:"Monetización" },
    { id:"api",          label:"API Keys",           icon:Key,           group:"Plataforma" },
    { id:"auditoria",    label:"Auditoría Global",   icon:Database,      group:"Plataforma" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════

function Sidebar({ role, activeView, setView, plan }) {
  const items = ROLE_VIEWS[role] || ROLE_VIEWS.Mandante;
  const groups = [...new Set(items.map(i => i.group))];

  return (
    <nav className="sidebar">
      <div className="sb-header">
        <div className="sb-logo-row">
          <div className="sb-logo-mark">
            <Anchor size={16} weight="fill" color="white" />
          </div>
          <span className="sb-brand">BERISA</span>
        </div>
        <div className="sb-tagline">Plataforma de Cumplimiento<br/>para Infraestructura</div>
      </div>

      <div className="sb-nav">
        {groups.map(group => (
          <div key={group}>
            <div className="sb-group-title">{group}</div>
            {items.filter(i => i.group === group).map(item => {
              const Icon = item.icon;
              const locked = item.plan && ["Starter"].includes(plan) && item.plan !== "Starter";
              return (
                <div
                  key={item.id}
                  className={`sb-link ${activeView === item.id ? "active" : ""}`}
                  onClick={() => !locked && setView(item.id)}
                  style={locked ? { opacity: 0.45 } : {}}
                >
                  <Icon size={16} weight={activeView === item.id ? "fill" : "regular"} className="sb-ico" />
                  <span style={{ flex:1 }}>{item.label}</span>
                  {locked && <Lock size={11} weight="fill" style={{ color:"var(--c-gold-500)", opacity:0.8 }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sb-footer">
        <div className="sb-status">
          <div className="sb-status-dot" />
          <span className="sb-status-label">Sistema operativo · v2.1.0</span>
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════

function Topbar({ role, setRole, plan, setPlan, activeView, navItems }) {
  const current = navItems?.find(i => i.id === activeView);
  const pageTitle = current?.label || "Dashboard";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span>BERISA</span>
          <CaretRight size={10} weight="bold" />
          <span>{pageTitle}</span>
        </div>
      </div>

      <div className="sim-bar">
        <span className="sim-label">Simulador</span>
        <div className="sim-divider" />
        <div className="sim-item">
          <span className="sim-item-label">Rol:</span>
          <select className="sim-select" value={role} onChange={e => setRole(e.target.value)}>
            <option>Mandante</option>
            <option>Proveedor</option>
            <option>Admin</option>
          </select>
        </div>
        <div className="sim-item">
          <span className="sim-item-label">Plan:</span>
          <select className="sim-select" value={plan} onChange={e => setPlan(e.target.value)}>
            <option>Starter</option>
            <option>Profesional</option>
            <option>Business</option>
            <option>Enterprise</option>
          </select>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button className="btn btn-ghost btn-icon" title="Notificaciones">
          <Bell size={17} weight="regular" />
        </button>
        <div style={{
          width:30, height:30, borderRadius:"50%",
          background:"linear-gradient(135deg, var(--c-teal-600), var(--c-teal-800))",
          display:"flex", alignItems:"center", justifyContent:"center"
        }}>
          <UserCircle size={18} weight="fill" color="white" />
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP for Recharts
// ═══════════════════════════════════════════════════════════════════

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"var(--c-zinc-900)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:10, padding:"10px 14px", boxShadow:"var(--shadow-lg)", minWidth:140
    }}>
      <div style={{ fontFamily:"var(--ff-mono)", fontSize:10, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"white", fontWeight:600 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:p.color || p.fill }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function ViewDashboard({ role }) {
  const kpis = role === "Admin"
    ? [
        { label:"Mandantes Activos",   value:12,    suffix:"",    icon:Buildings,      color:"teal",  help:"7 activos este mes" },
        { label:"Proveedores",         value:187,   suffix:"",    icon:Users,          color:"teal",  help:"43 nuevos en 30d" },
        { label:"Contratos Activos",   value:94,    suffix:"",    icon:Briefcase,      color:"gold",  help:"12 por vencer" },
        { label:"MRR",                 value:"$48K",suffix:"",    icon:CurrencyDollar, color:"green", help:"↑ 14% vs mes ant." },
      ]
    : role === "Proveedor"
    ? [
        { label:"ICE Nivel",           value:"ICE-3",suffix:"",   icon:MedalMilitary,  color:"teal",  help:"Permanente en faena" },
        { label:"Score Cumplimiento",  value:82,    suffix:"%",   icon:ShieldCheck,    color:"green", help:"Por encima del umbral" },
        { label:"Docs Vigentes",       value:14,    suffix:"/16", icon:FileText,       color:"gold",  help:"2 vencen en 8d" },
        { label:"Incidentes 30d",      value:0,     suffix:"",    icon:HardHat,        color:"teal",  help:"Sin AT este período" },
      ]
    : [
        { label:"Proveedores Activos", value:18,    suffix:"",    icon:Buildings,      color:"teal",  help:"3 con alertas" },
        { label:"Cumplimiento Global", value:74,    suffix:"%",   icon:ShieldCheck,    color:"green", help:"↑4pp vs trimestre ant." },
        { label:"Oportunidades",       value:6,     suffix:"",    icon:Handshake,      color:"gold",  help:"US$ 648M en cartera" },
        { label:"Incidentes Activos",  value:4,     suffix:"",    icon:Siren,          color:"red",   help:"1 grave — 35 días perdidos" },
      ];

  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">{role === "Admin" ? "Plataforma BERISA SaaS" : role === "Proveedor" ? "Mi Panel" : "Panel de Control"}</div>
        <div className="section-title">Resumen Ejecutivo</div>
        <div className="section-subtitle">Datos actualizados al {new Date().toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" })}</div>
      </div>

      {/* KPI Grid */}
      <motion.div
        className="kpi-grid mb-6"
        initial="hidden"
        animate="show"
        variants={{ hidden:{opacity:0}, show:{ opacity:1, transition:{ staggerChildren:0.07 }} }}
      >
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              className={`kpi-card kpi-${k.color}`}
              variants={{ hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0, transition:{ type:"spring", stiffness:160 }} }}
            >
              <div className="kpi-icon-wrap"><Icon size={18} weight="duotone" /></div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}{k.suffix}</div>
              <div className="kpi-helper">{k.help}</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts Row */}
      <div className="grid-2 mb-5">
        <div className="card card-accent-teal">
          <div className="card-head">
            <div>
              <div className="card-title">Tendencia de Actividad</div>
              <div className="card-subtitle">Últimos 6 meses</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trendData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2A9D8E" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2A9D8E" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9972B" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#C9972B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize:10, fontFamily:"var(--ff-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fontFamily:"var(--ff-mono)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="contratos"   name="Contratos"   stroke="#2A9D8E" fill="url(#gTeal)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="proveedores" name="Proveedores" stroke="#C9972B" fill="url(#gGold)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-accent-gold">
          <div className="card-head">
            <div>
              <div className="card-title">Estado de Cumplimiento</div>
              <div className="card-subtitle">Distribución actual</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={compliancePie} cx="50%" cy="50%" innerRadius={48} outerRadius={70}
                     dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                  {compliancePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
              {compliancePie.map(e => (
                <div key={e.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:e.color }} />
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>{e.name}</span>
                  </div>
                  <span style={{ fontFamily:"var(--ff-mono)", fontWeight:700, fontSize:13 }}>{e.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HSE Bar */}
      <div className="card card-accent-red mb-5">
        <div className="card-head">
          <div>
            <div className="card-title">Indicadores HSE del Período</div>
            <div className="card-subtitle">Accidentabilidad y no conformidades</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={hseBar} margin={{ top:0, right:0, left:-20, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
            <XAxis dataKey="cat" tick={{ fontSize:10, fontFamily:"var(--ff-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fontFamily:"var(--ff-mono)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="val" name="Cantidad" radius={[4,4,0,0]} maxBarSize={40}>
              {hseBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Audit tail */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Actividad Reciente</div>
          <button className="btn btn-ghost btn-sm"><Eye size={13}/> Ver auditoría completa</button>
        </div>
        <div className="audit-list">
          {seedAudit.slice(0,4).map((a, i) => (
            <div key={i} className="audit-item">
              <span className="audit-time text-mono">{a.time}</span>
              <span className="audit-actor">{a.actor.split("@")[0]}</span>
              <span className="audit-action">{a.action}</span>
              <span className="audit-target">{a.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: OPORTUNIDADES — Pipeline Kanban
// ═══════════════════════════════════════════════════════════════════

function ViewOportunidades() {
  const [opps, setOpps] = useState(seedOpportunities);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", source:"", capex:"", stage:"Prospecto", region:"", mandante:"" });

  const byStage = (s) => opps.filter(o => o.stage === s);

  const advanceStage = (id) => setOpps(prev => prev.map(o => {
    if (o.id !== id) return o;
    const idx = stages.indexOf(o.stage);
    return idx < stages.length - 1 ? { ...o, stage: stages[idx + 1] } : o;
  }));

  const addOpp = () => {
    if (!form.name) return;
    setOpps(prev => [...prev, { ...form, id:`op-${Date.now()}`, capex: Number(form.capex) || 0, services:[] }]);
    setForm({ name:"", source:"", capex:"", stage:"Prospecto", region:"", mandante:"" });
    setShowForm(false);
  };

  const totalCapex = opps.reduce((s, o) => s + (o.capex || 0), 0);

  return (
    <div className="view-content">
      <div className="section-head" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <div className="section-eyebrow">CRM de Proyectos</div>
          <div className="section-title">Pipeline de Oportunidades</div>
          <div className="section-subtitle">Cartera total: <strong>{mmusd(totalCapex)}</strong> en {opps.length} oportunidades</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} weight="bold" /> Nueva Oportunidad
        </button>
      </div>

      {/* Quick form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity:0, height:0, marginBottom:0 }}
            animate={{ opacity:1, height:"auto", marginBottom:20 }}
            exit={{ opacity:0, height:0, marginBottom:0 }}
            style={{ overflow:"hidden" }}
          >
            <div className="card card-accent-teal">
              <div className="card-title" style={{ marginBottom:16 }}>Nueva Oportunidad</div>
              <div className="grid-3" style={{ gap:12, marginBottom:12 }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Proyecto *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Nombre del proyecto" />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Mandante</label>
                  <input className="form-input" value={form.mandante} onChange={e => setForm({...form, mandante:e.target.value})} placeholder="Codelco, MOP..." />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">CAPEX (US$ M)</label>
                  <input className="form-input" type="number" value={form.capex} onChange={e => setForm({...form, capex:e.target.value})} placeholder="e.g. 45" />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Fuente</label>
                  <select className="form-select" value={form.source} onChange={e => setForm({...form, source:e.target.value})}>
                    <option value="">Seleccionar</option>
                    <option>SEIA</option><option>MOP</option><option>Mercado Público</option><option>Privado</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Región</label>
                  <input className="form-input" value={form.region} onChange={e => setForm({...form, region:e.target.value})} placeholder="Antofagasta..." />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Etapa Inicial</label>
                  <select className="form-select" value={form.stage} onChange={e => setForm({...form, stage:e.target.value})}>
                    {stages.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={addOpp}><Plus size={13}/> Agregar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Board */}
      <div className="kanban-wrap">
        <div className="kanban-board">
          {stages.map(stage => {
            const cards = byStage(stage);
            return (
              <div key={stage} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{stage}</span>
                  <span className="kanban-col-count">{cards.length}</span>
                </div>
                <div className="kanban-cards">
                  {cards.map(o => (
                    <motion.div key={o.id} layout className="kanban-card">
                      <div className="kanban-card-name">{o.name}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>
                        {o.mandante} · {o.region}
                      </div>
                      <div className="kanban-card-meta">
                        <span className="kanban-card-value">{mmusd(o.capex)}</span>
                        {stage !== "Cerrado" && (
                          <button className="kanban-advance-btn" onClick={() => advanceStage(o.id)} title="Avanzar etapa">
                            <CaretRight size={10} weight="bold" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {cards.length === 0 && (
                    <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text-muted)", fontSize:11 }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: DIRECTORIO PROVEEDORES
// ═══════════════════════════════════════════════════════════════════

function ViewProveedores({ role, plan }) {
  const [vendors, setVendors] = useState(seedVendors);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ ice:"", compliance:"", search:"" });
  const [tab, setTab] = useState("lista");

  const filtered = useMemo(() => vendors.filter(v => {
    if (filter.ice && v.iceLevel !== Number(filter.ice)) return false;
    if (filter.compliance && v.compliance !== filter.compliance) return false;
    if (filter.search && !v.name.toLowerCase().includes(filter.search.toLowerCase()) &&
        !v.rut.includes(filter.search)) return false;
    return true;
  }), [vendors, filter]);

  const sel = vendors.find(v => v.id === selected);

  const ScoreCat = ({ label, value }) => (
    <div className="score-item">
      <span className="score-label">{label}</span>
      <div className="score-track"><div className="score-fill" style={{ width:`${value}%`, background:`linear-gradient(90deg, ${scoreColor(value)}, ${scoreColor(value)}80)` }} /></div>
      <span className="score-val" style={{ color:scoreColor(value) }}>{value}</span>
    </div>
  );

  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Contratistas y Proveedores</div>
        <div className="section-title">Directorio de Proveedores</div>
        <div className="section-subtitle">Evaluación ICE, score de cumplimiento y documentación</div>
      </div>

      <div className="subtab-row">
        {[{id:"lista",label:"Lista"},{id:"scorecard",label:"Scorecard ICE"},{id:"vencimientos",label:"Vencimientos"}].map(t => (
          <button key={t.id} className={`subtab-btn ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <MagnifyingGlass size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)" }} />
          <input className="form-input" style={{ paddingLeft:30, width:"100%" }} placeholder="Buscar por nombre o RUT..." value={filter.search} onChange={e => setFilter({...filter,search:e.target.value})} />
        </div>
        <select className="form-select" style={{ width:160 }} value={filter.ice} onChange={e => setFilter({...filter,ice:e.target.value})}>
          <option value="">Todos los ICE</option>
          {[1,2,3,4].map(n => <option key={n} value={n}>{ICE_LABELS[n]}</option>)}
        </select>
        <select className="form-select" style={{ width:160 }} value={filter.compliance} onChange={e => setFilter({...filter,compliance:e.target.value})}>
          <option value="">Todo Cumplimiento</option>
          <option>Conforme</option><option>Observado</option><option>No Conforme</option>
        </select>
      </div>

      {tab === "lista" && (
        <div className={`grid-2-1 ${sel ? "" : ""}`} style={sel ? { display:"grid", gridTemplateColumns:"1fr 380px", gap:20 } : {}}>
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap" style={{ border:"none", borderRadius:"var(--r-lg)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>ICE</th>
                    <th>Servicio</th>
                    <th>Score</th>
                    <th>Estado</th>
                    <th>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id} onClick={() => setSelected(selected===v.id ? null : v.id)}
                        style={{ cursor:"pointer", background: selected===v.id ? "var(--c-teal-50)" : "" }}>
                      <td>
                        <strong>{v.name}</strong>
                        <small>{v.rut} · {v.type}</small>
                      </td>
                      <td><span className={`ice-badge ice-${v.iceLevel}`}>ICE-{v.iceLevel}</span></td>
                      <td style={{ maxWidth:160, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.service}</td>
                      <td>
                        <span style={{ fontFamily:"var(--ff-mono)", fontWeight:700, fontSize:13, color:scoreColor(v.score) }}>{v.score}</span>
                      </td>
                      <td><span className={`pill ${complianceClass(v.compliance)}`}><span className="pill-dot"/>{v.compliance}</span></td>
                      <td>
                        <span style={{ fontFamily:"var(--ff-mono)", fontSize:11, color: v.daysUntilExpiry<=15 ? "var(--c-red-600)" : "var(--text-muted)" }}>
                          {v.daysUntilExpiry === 0 ? "Vencido" : `${v.daysUntilExpiry}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {sel && (
              <motion.div key={sel.id} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}>
                <div className="card card-accent-teal">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                    <div>
                      <div style={{ fontFamily:"var(--ff-head)", fontSize:15, fontWeight:700 }}>{sel.name}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{sel.rut} · {sel.service}</div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(null)}><XCircle size={16}/></button>
                  </div>
                  <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                    <span className={`ice-badge ice-${sel.iceLevel}`}>ICE-{sel.iceLevel}</span>
                    <span className={`pill ${complianceClass(sel.compliance)}`}><span className="pill-dot"/>{sel.compliance}</span>
                  </div>
                  <div className="total-score-ring">
                    <div style={{ fontSize:11, fontFamily:"var(--ff-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Score Total</div>
                    <div className="total-score-num" style={{ color:scoreColor(sel.score) }}>{sel.score}</div>
                    <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:4 }}>/100</div>
                  </div>
                  <div className="score-list">
                    <ScoreCat label="HSE" value={sel.score} />
                    <ScoreCat label="Calidad" value={Math.max(0, sel.score - 5)} />
                    <ScoreCat label="Financiero" value={Math.max(0, sel.score - 10)} />
                    <ScoreCat label="Ambiental" value={Math.max(0, sel.score - 3)} />
                    <ScoreCat label="Desempeño" value={Math.max(0, sel.score - 7)} />
                    <ScoreCat label="Documental" value={Math.min(100, sel.score + 8)} />
                  </div>
                  {role === "Mandante" && (
                    <div style={{ marginTop:16, display:"flex", gap:8 }}>
                      <button className="btn btn-primary" style={{ flex:1, fontSize:12 }}><Eye size={13}/> Ver perfil completo</button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {tab === "scorecard" && (
        <PlanGate plan={plan} required="Profesional">
          <div className="grid-3">
            {filtered.map(v => (
              <div key={v.id} className={`card card-accent-${iceColor(v.iceLevel)}`}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div style={{ fontWeight:700, fontSize:13, lineHeight:1.3 }}>{v.name}</div>
                  <span className={`ice-badge ice-${v.iceLevel}`}>ICE-{v.iceLevel}</span>
                </div>
                <div style={{ fontFamily:"var(--ff-head)", fontSize:32, fontWeight:800, color:scoreColor(v.score), marginBottom:4 }}>
                  {v.score}<span style={{ fontSize:14, fontFamily:"var(--ff-body)", color:"var(--text-muted)" }}>/100</span>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div className="score-track" style={{ height:8 }}>
                    <div className="score-fill" style={{ width:`${v.score}%`, height:"100%", background:`linear-gradient(90deg, ${scoreColor(v.score)}, ${scoreColor(v.score)}60)` }} />
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)" }}>
                  <span><Users size={11}/> {v.workers} trabajadores</span>
                  <span className={`pill ${complianceClass(v.compliance)}`} style={{ fontSize:10 }}><span className="pill-dot"/>{v.compliance}</span>
                </div>
              </div>
            ))}
          </div>
        </PlanGate>
      )}

      {tab === "vencimientos" && (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap" style={{ border:"none" }}>
            <table className="data-table">
              <thead><tr><th>Proveedor</th><th>ICE</th><th>Días hasta Vencimiento</th><th>Estado</th></tr></thead>
              <tbody>
                {[...filtered].sort((a,b) => a.daysUntilExpiry - b.daysUntilExpiry).map(v => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong><small>{v.rut}</small></td>
                    <td><span className={`ice-badge ice-${v.iceLevel}`}>ICE-{v.iceLevel}</span></td>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ flex:1, maxWidth:200 }} className="score-track">
                          <div className="score-fill" style={{
                            width:`${Math.min(100, (v.daysUntilExpiry / 180) * 100)}%`,
                            background: v.daysUntilExpiry <= 15 ? "var(--c-red-500)" : v.daysUntilExpiry <= 30 ? "var(--c-gold-500)" : "var(--c-teal-500)"
                          }} />
                        </div>
                        <span style={{ fontFamily:"var(--ff-mono)", fontSize:12, fontWeight:700,
                          color: v.daysUntilExpiry === 0 ? "var(--c-red-600)" : v.daysUntilExpiry <= 15 ? "var(--c-red-600)" : "var(--text-primary)" }}>
                          {v.daysUntilExpiry === 0 ? "VENCIDO" : `${v.daysUntilExpiry}d`}
                        </span>
                      </div>
                    </td>
                    <td><span className={`pill ${complianceClass(v.compliance)}`}><span className="pill-dot"/>{v.compliance}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════════

function ViewMatching({ plan }) {
  const [query, setQuery] = useState({ service:"", region:"", iceMin:"1", capex:"" });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runMatch = () => {
    setLoading(true);
    setResults(null);
    setTimeout(() => {
      const scored = seedVendors
        .filter(v => (!query.iceMin || v.iceLevel >= Number(query.iceMin)))
        .map(v => ({
          ...v,
          matchPct: Math.min(100, Math.round(
            (query.service ? (v.service.toLowerCase().includes(query.service.toLowerCase()) ? 30 : 0) : 20)
            + (query.region ? (v.region.toLowerCase().includes(query.region.toLowerCase()) ? 25 : 5) : 15)
            + v.score * 0.5
          ))
        }))
        .sort((a,b) => b.matchPct - a.matchPct)
        .slice(0, 5);
      setResults(scored);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">IA · Inteligencia Artificial</div>
        <div className="section-title">Matching Engine de Proveedores</div>
        <div className="section-subtitle">Algoritmo multicritério con scoring ICE, cumplimiento, experiencia sectorial y cercanía geográfica</div>
      </div>

      <PlanGate plan={plan} required="Profesional">
        <div className="card card-accent-teal mb-5">
          <div className="card-title" style={{ marginBottom:16 }}>Definir Requerimiento</div>
          <div className="grid-2" style={{ gap:12, marginBottom:16 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Tipo de Servicio</label>
              <input className="form-input" placeholder="Obras civiles, montaje, sensores..." value={query.service} onChange={e => setQuery({...query, service:e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Región de la Faena</label>
              <input className="form-input" placeholder="Antofagasta, Atacama..." value={query.region} onChange={e => setQuery({...query, region:e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">ICE Mínimo Requerido</label>
              <select className="form-select" value={query.iceMin} onChange={e => setQuery({...query, iceMin:e.target.value})}>
                {[1,2,3,4].map(n => <option key={n} value={n}>{ICE_LABELS[n]}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">CAPEX aprox. (US$ M)</label>
              <input className="form-input" type="number" placeholder="45" value={query.capex} onChange={e => setQuery({...query, capex:e.target.value})} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={runMatch} disabled={loading} style={{ width:"100%" }}>
            {loading
              ? <><ArrowsCounterClockwise size={14} style={{ animation:"spin 0.8s linear infinite" }}/> Analizando con IA...</>
              : <><Robot size={14} weight="fill"/> Ejecutar Matching</>
            }
          </button>
        </div>

        <AnimatePresence>
          {results && (
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <div className="section-head" style={{ marginBottom:12 }}>
                <div className="section-eyebrow">Resultados</div>
                <div className="section-title" style={{ fontSize:16 }}>{results.length} Proveedores Compatible{results.length!==1?"s":""}</div>
              </div>
              {results.map((v, i) => (
                <div key={v.id} className="match-item">
                  <div className="match-rank">#{i+1}</div>
                  <div className="match-info">
                    <div className="match-name">{v.name}</div>
                    <div className="match-meta">
                      <span><MapPin size={10}/> {v.region}</span>
                      <span><Hash size={10}/> {v.rut}</span>
                      <span>Score: {v.score}/100</span>
                    </div>
                    <div className="match-flags">
                      <span className={`ice-badge ice-${v.iceLevel}`}>ICE-{v.iceLevel}</span>
                      <span className={`pill ${complianceClass(v.compliance)}`}><span className="pill-dot"/>{v.compliance}</span>
                    </div>
                  </div>
                  <div className="match-pct" style={{ color: v.matchPct>=80 ? "var(--c-green-500)" : v.matchPct>=60 ? "var(--c-gold-500)" : "var(--c-red-500)" }}>
                    {v.matchPct}%
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </PlanGate>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: HSE
// ═══════════════════════════════════════════════════════════════════

function ViewHSE({ role, plan }) {
  const [incidents, setIncidents] = useState(seedIncidents);
  const [tab, setTab] = useState("incidentes");
  const [risks] = useState(seedRisks);
  const [form, setForm] = useState({ date:"", cat:"Leve", desc:"", workers:1, code:"", vendor:"v-001" });
  const [showForm, setShowForm] = useState(false);

  const totalAT = incidents.length;
  const gravesAT = incidents.filter(i => i.cat === "Grave" || i.cat === "Accidente").length;
  const diasPerdidos = incidents.reduce((s,i) => s + i.daysLost, 0);
  const tasa = totalAT > 0 ? ((gravesAT / (diasPerdidos || 1)) * 1000).toFixed(2) : "0.00";

  const addIncident = () => {
    if (!form.date || !form.desc) return;
    setIncidents(prev => [...prev, { ...form, id:`inc-${Date.now()}`, daysLost: form.cat === "Grave" ? 30 : 2 }]);
    setShowForm(false);
  };

  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Salud, Seguridad y Medioambiente</div>
        <div className="section-title">Gestión HSE</div>
      </div>

      <div className="kpi-grid mb-6" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
        {[
          { label:"Total Accidentes", value:totalAT,   color:"gold", icon:HardHat },
          { label:"AT Graves",        value:gravesAT,  color:gravesAT>0?"red":"green", icon:Siren },
          { label:"Días Perdidos",    value:diasPerdidos, color:"zinc", icon:CalendarBlank },
          { label:"Tasa de Siniestros",value:tasa,     color:"teal", icon:ChartLineUp },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`kpi-card kpi-${k.color}`}>
              <div className="kpi-icon-wrap"><Icon size={18} weight="duotone"/></div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
            </div>
          );
        })}
      </div>

      <div className="subtab-row">
        {[{id:"incidentes",label:"Registro de Incidentes"},{id:"riesgos",label:"Mapa de Riesgos"},{id:"entrenamiento",label:"Entrenamientos"}].map(t => (
          <button key={t.id} className={`subtab-btn ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "incidentes" && (
        <>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={13}/> Registrar Incidente</button>
          </div>
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
                <div className="card card-accent-red">
                  <div className="card-title" style={{marginBottom:12}}>Nuevo Incidente / AT</div>
                  <div className="grid-2" style={{gap:10,marginBottom:10}}>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label">Fecha</label>
                      <input className="form-input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
                    </div>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label">Categoría</label>
                      <select className="form-select" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>
                        <option>Leve</option><option>Grave</option><option>Accidente</option>
                      </select>
                    </div>
                    <div className="form-group" style={{marginBottom:0,gridColumn:"1/-1"}}>
                      <label className="form-label">Descripción</label>
                      <textarea className="form-textarea" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} rows={2} placeholder="Describe el incidente..." />
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button className="btn btn-secondary btn-sm" onClick={()=>setShowForm(false)}>Cancelar</button>
                    <button className="btn btn-danger btn-sm" onClick={addIncident}><Plus size={12}/> Registrar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="card" style={{padding:0}}>
            <div className="table-wrap" style={{border:"none"}}>
              <table className="data-table">
                <thead><tr><th>Código</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Días Perdidos</th></tr></thead>
                <tbody>
                  {incidents.map(i => (
                    <tr key={i.id}>
                      <td><span className="text-mono" style={{fontSize:11}}>{i.code}</span></td>
                      <td>{i.date}</td>
                      <td><span className={`pill ${catClass(i.cat)}`}><span className="pill-dot"/>{i.cat}</span></td>
                      <td>{i.desc}</td>
                      <td><span className="text-mono fw-700">{i.daysLost}d</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "riesgos" && (
        <div className="grid-2">
          <div className="card card-accent-gold">
            <div className="card-title" style={{marginBottom:4}}>Matriz de Riesgos 5×5</div>
            <div className="card-subtitle" style={{marginBottom:16}}>Probabilidad × Severidad</div>
            <div className="matrix-outer">
              <div className="matrix-y-axis">Probabilidad ↑</div>
              <div className="matrix-inner">
                <div className="matrix-grid">
                  {[5,4,3,2,1].map(prob => (
                    <div key={prob} className="matrix-row">
                      {[1,2,3,4,5].map(sev => {
                        const score = prob * sev;
                        const cls = score >= 20 ? "risk-crit" : score >= 12 ? "risk-high" : score >= 6 ? "risk-med" : "risk-low";
                        const count = risks.filter(r => r.prob === prob && r.sev === sev).length;
                        return (
                          <div key={sev} className={`matrix-cell ${cls}`}>
                            {score}
                            {count > 0 && <span className="matrix-count">{count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="matrix-x-axis">{[1,2,3,4,5].map(s => <span key={s}>S{s}</span>)}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{marginBottom:12}}>Registro de Riesgos</div>
            {risks.map(r => (
              <div key={r.id} style={{borderBottom:"1px solid var(--border)", paddingBottom:10, marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)"}}>{r.name}</span>
                  <span className={`pill ${catClass(r.category)}`} style={{fontSize:10}}><span className="pill-dot"/>{r.category}</span>
                </div>
                <div style={{fontSize:11,color:"var(--text-muted)"}}>P{r.prob} × S{r.sev} = <strong style={{color:"var(--text-primary)"}}>{r.prob*r.sev}</strong></div>
                <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:4}}>{r.control}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "entrenamiento" && (
        <PlanGate plan={plan} required="Business">
          <div className="card">
            <div className="card-title" style={{marginBottom:12}}>Módulos de Entrenamiento Activos</div>
            {[
              {name:"Trabajo en Altura y Andamios",  workers:142, completed:130, due:"2026-07-15"},
              {name:"Manejo Defensivo Vehículos Livianos",workers:80,completed:72, due:"2026-08-01"},
              {name:"LOTO — Bloqueo y Etiquetado",   workers:60,  completed:60,  due:"2026-09-30"},
            ].map(t => (
              <div key={t.name} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                <Certificate size={20} weight="duotone" color="var(--c-teal-600)" style={{flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{t.name}</div>
                  <div className="score-track"><div className="score-fill" style={{width:`${Math.round(t.completed/t.workers*100)}%`}}/></div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"var(--ff-mono)",fontSize:12,fontWeight:700,color:"var(--c-teal-700)"}}>{t.completed}/{t.workers}</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>Vence {t.due}</div>
                </div>
              </div>
            ))}
          </div>
        </PlanGate>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: CUMPLIMIENTO AMBIENTAL
// ═══════════════════════════════════════════════════════════════════

function ViewAmbiental({ plan }) {
  const [rca] = useState(seedRca);
  const [respel] = useState(seedRespel);
  const [tab, setTab] = useState("rca");
  const [testVal, setTestVal] = useState("");
  const [testResult, setTestResult] = useState(null);

  const statusClass = (s) => s === "Conforme" ? "green" : s === "Observada" ? "yellow" : "red";

  const testHygiene = () => {
    const v = parseFloat(testVal);
    if (isNaN(v)) { setTestResult(null); return; }
    const limit = 85;
    if (v <= limit * 0.7) setTestResult({ cls:"conforme", label:"Conforme", msg:`Valor ${v} dBA — por debajo del 70% del límite (${limit} dBA)` });
    else if (v <= limit) setTestResult({ cls:"advertencia", label:"Advertencia", msg:`Valor ${v} dBA — entre 70% y 100% del límite (${limit} dBA)` });
    else setTestResult({ cls:"no-conforme", label:"No Conforme", msg:`Valor ${v} dBA — SUPERA el límite de ${limit} dBA` });
  };

  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Medio Ambiente · RCA · RESPEL</div>
        <div className="section-title">Cumplimiento Ambiental</div>
      </div>

      <div className="subtab-row">
        {[{id:"rca",label:"Condiciones RCA"},{id:"respel",label:"Residuos Peligrosos"},{id:"higiene",label:"Higiene Ocupacional"}].map(t => (
          <button key={t.id} className={`subtab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "rca" && (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap" style={{border:"none"}}>
            <table className="data-table">
              <thead><tr><th>Condición RCA</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
              <tbody>
                {rca.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.condition}</strong></td>
                    <td><span className={`pill ${statusClass(r.status)}`}><span className="pill-dot"/>{r.status}</span></td>
                    <td><span className="text-mono fs-11">{r.date}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon"><Eye size={13}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "respel" && (
        <>
          <div className="kpi-grid mb-5" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
            {[
              {label:"Manifiestos emitidos", value:respel.length, color:"teal", icon:FileText},
              {label:"Total RESPEL (kg)",    value:respel.reduce((s,r)=>s+r.kg,0)+"kg", color:"gold", icon:Biohazard},
              {label:"Gestores autorizados", value:3,  color:"green", icon:SealCheck},
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className={`kpi-card kpi-${k.color}`}>
                  <div className="kpi-icon-wrap"><Icon size={18} weight="duotone"/></div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value">{k.value}</div>
                </div>
              );
            })}
          </div>
          <div className="card" style={{padding:0}}>
            <div className="table-wrap" style={{border:"none"}}>
              <table className="data-table">
                <thead><tr><th>Tipo de Residuo</th><th>Peso (kg)</th><th>Centro Autorizado</th><th>Certificado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {respel.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.type}</strong></td>
                      <td><span className="text-mono fw-700">{r.kg}</span></td>
                      <td>{r.center}</td>
                      <td><span className="api-key-mono">{r.cert}</span></td>
                      <td><span className="text-mono fs-11">{r.date}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "higiene" && (
        <div className="grid-2">
          <div className="card card-accent-teal">
            <div className="card-title" style={{marginBottom:4}}>Calculadora de Higiene Ocupacional</div>
            <div className="card-subtitle" style={{marginBottom:16}}>Ingresa el valor medido para verificar cumplimiento</div>
            <div className="form-group">
              <label className="form-label">Nivel de Ruido Medido (dBA)</label>
              <div className="form-row">
                <input className="form-input" type="number" placeholder="Ej: 88" value={testVal} onChange={e=>setTestVal(e.target.value)} />
                <button className="btn btn-primary" onClick={testHygiene}><Lightning size={13} weight="fill"/> Evaluar</button>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {testResult && (
                <motion.div key={testResult.cls} initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
                  <div className={`hygiene-display ${testResult.cls}`}>
                    <div className="hygiene-number">{testVal} dBA</div>
                    <span className={`pill ${testResult.cls==="conforme"?"green":testResult.cls==="advertencia"?"yellow":"red"}`} style={{fontSize:13}}>
                      <span className="pill-dot"/>{testResult.label}
                    </span>
                    <div className="hygiene-limit" style={{textAlign:"center"}}>{testResult.msg}</div>
                  </div>
                </motion.div>
              )}
              {!testResult && (
                <div className="hygiene-display empty">
                  <DropHalf size={32} weight="duotone" style={{opacity:0.3, color:"var(--c-teal-600)"}} />
                  <span className="hygiene-agent">Ingresa un valor para evaluar</span>
                </div>
              )}
            </AnimatePresence>
          </div>
          <div className="card">
            <div className="card-title" style={{marginBottom:12}}>Umbrales de Referencia (DS 594)</div>
            {[
              {agent:"Ruido (8h)",       limit:"85 dBA", unit:"Leq"},
              {agent:"Silice libre",     limit:"0.025 mg/m³", unit:"UVCE"},
              {agent:"CO",               limit:"29 mg/m³", unit:"TWA"},
              {agent:"Polvo inerte",     limit:"10 mg/m³", unit:"TWA"},
              {agent:"Temperatura (TGBH)",limit:"29.5°C", unit:"Trabajo pesado"},
            ].map(a => (
              <div key={a.agent} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{a.agent}</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>{a.unit}</div>
                </div>
                <span className="api-key-mono">{a.limit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: AUDITORÍA
// ═══════════════════════════════════════════════════════════════════

function ViewAuditoria({ role }) {
  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Trazabilidad · Blockchain-ready</div>
        <div className="section-title">Registro de Auditoría</div>
        <div className="section-subtitle">Log inmutable de todas las acciones en la plataforma</div>
      </div>

      <div className="callout callout-teal" style={{marginTop:0}}>
        <div className="callout-icon"><Info size={22} weight="duotone" color="var(--c-teal-600)"/></div>
        <div className="callout-body">
          <strong>Log inmutable SHA-256</strong>
          Cada evento incluye hash SHA-256 encadenado con el evento anterior. Los registros no pueden ser modificados ni eliminados.
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap" style={{border:"none"}}>
          <table className="data-table">
            <thead><tr><th>Hora</th><th>Actor</th><th>Rol</th><th>Acción</th><th>Objeto</th></tr></thead>
            <tbody>
              {seedAudit.map((a, i) => (
                <tr key={i}>
                  <td><span className="text-mono fs-11">{a.time}</span></td>
                  <td><strong>{a.actor}</strong></td>
                  <td><span className={`pill ${a.role==="Admin"?"teal":a.role==="Mandante"?"blue":a.role==="Auditor"?"yellow":"slate"}`}>{a.role}</span></td>
                  <td>{a.action}</td>
                  <td style={{maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: PLANES SaaS (Admin)
// ═══════════════════════════════════════════════════════════════════

const PLANS_DEF = [
  {
    name:"Starter",
    price:"$390",
    color:"slate",
    desc:"Para mandantes que inician con cumplimiento básico.",
    features:["1 faena activa","Hasta 10 proveedores","Panel HSE básico","Exportación PDF"],
    notIncluded:["Matching Engine","RCA ambiental","API externa","Multi-faena"]
  },
  {
    name:"Profesional",
    price:"$990",
    color:"teal",
    desc:"El plan más popular para empresas en crecimiento.",
    features:["5 faenas activas","Proveedores ilimitados","Matching Engine IA","RCA ambiental","Score ICE automático","Soporte 48h"],
    notIncluded:["Multi-mandante","API pública","SSO / SAML"],
    popular:true
  },
  {
    name:"Business",
    price:"$2,490",
    color:"gold",
    desc:"Para empresas con múltiples faenas y proyectos SEIA.",
    features:["Faenas ilimitadas","Gestión multi-mandante","API pública documentada","Entrenamiento HSE IA","Firma electrónica","Soporte 24h"],
    notIncluded:["Onpremise / SLA 99.9%"]
  },
  {
    name:"Enterprise",
    price:"Custom",
    color:"zinc",
    desc:"Despliegue dedicado para grandes grupos empresariales.",
    features:["Todo Business incluido","SLA 99.9% contractual","SSO / SAML federado","Onpremise / híbrido","CSM dedicado","Auditoría blockchain"],
    notIncluded:[]
  },
];

function ViewPlanes() {
  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Monetización SaaS</div>
        <div className="section-title">Planes de Suscripción</div>
        <div className="section-subtitle">Modelo freemium multi-plan con upgrades in-app</div>
      </div>

      <div className="grid-2" style={{gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
        {PLANS_DEF.map(p => (
          <div key={p.name} className={`card ${p.popular?"card-accent-teal":""}`}
               style={p.popular ? {boxShadow:"var(--shadow-teal)"} : {}}>
            {p.popular && (
              <div style={{background:"var(--c-teal-700)",color:"white",fontSize:10,fontWeight:700,fontFamily:"var(--ff-mono)",
                letterSpacing:1,textTransform:"uppercase",padding:"3px 10px",borderRadius:"var(--r-full)",
                display:"inline-block",marginBottom:10}}>Más popular</div>
            )}
            <div style={{fontFamily:"var(--ff-head)",fontSize:16,fontWeight:800,color:"var(--text-primary)",marginBottom:3}}>{p.name}</div>
            <div style={{fontFamily:"var(--ff-head)",fontSize:28,fontWeight:800,color:"var(--c-teal-700)",marginBottom:6}}>
              {p.price}<span style={{fontSize:13,fontFamily:"var(--ff-body)",color:"var(--text-muted)",fontWeight:400}}>{p.price!=="Custom"?"/mes":""}</span>
            </div>
            <div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:16,lineHeight:1.5}}>{p.desc}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
              {p.features.map(f => (
                <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <CheckCircle size={13} weight="fill" color="var(--c-green-500)"/>{f}
                </div>
              ))}
              {p.notIncluded.map(f => (
                <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text-muted)"}}>
                  <XCircle size={13} weight="regular" color="var(--c-zinc-300)"/>{f}
                </div>
              ))}
            </div>
            <button className={`btn ${p.popular?"btn-primary":"btn-secondary"}`} style={{width:"100%",fontSize:12}}>
              {p.price==="Custom"?"Contactar ventas":"Seleccionar plan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: API KEYS (Admin)
// ═══════════════════════════════════════════════════════════════════

function ViewApiKeys() {
  const [keys, setKeys] = useState([
    { id:"k-1", name:"Codelco Integration v2",    key:"brsa_live_ck9xP...rT3q", created:"2026-01-15", lastUsed:"Hace 2h",  active:true },
    { id:"k-2", name:"MOP Data Sync",             key:"brsa_live_mX7aQ...k9Lm", created:"2026-03-08", lastUsed:"Hace 1d",  active:true },
    { id:"k-3", name:"Testing — Sandbox Enel",    key:"brsa_test_zZ3nW...p2Ks", created:"2026-05-20", lastUsed:"Hace 5d",  active:false },
  ]);

  const toggle = (id) => setKeys(prev => prev.map(k => k.id===id ? {...k,active:!k.active} : k));

  return (
    <div className="view-content">
      <div className="section-head" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div className="section-eyebrow">Plataforma API</div>
          <div className="section-title">API Keys & Integraciones</div>
          <div className="section-subtitle">REST API v2 — autenticación Bearer token</div>
        </div>
        <button className="btn btn-primary"><Plus size={14}/> Nueva API Key</button>
      </div>

      <div className="callout callout-gold">
        <div className="callout-icon"><Warning size={22} weight="duotone" color="var(--c-gold-600)"/></div>
        <div className="callout-body">
          <strong>Seguridad de Claves</strong>
          Las claves sólo se muestran completas una vez al crearlas. Guárdalas en un gestor de secretos (Vault, AWS Secrets Manager).
        </div>
      </div>

      {keys.map(k => (
        <div key={k.id} className="api-key-item">
          <Key size={18} weight="duotone" color="var(--c-teal-600)" style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{k.name}</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <span className="api-key-mono">{k.key}</span>
              <span style={{fontSize:11,color:"var(--text-muted)"}}>Creada {k.created}</span>
              <span style={{fontSize:11,color:"var(--text-muted)"}}>Usada {k.lastUsed}</span>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className={`pill ${k.active?"green":"slate"}`}><span className="pill-dot"/>{k.active?"Activa":"Inactiva"}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => toggle(k.id)}>{k.active?"Desactivar":"Activar"}</button>
            <button className="btn btn-ghost btn-icon btn-sm"><Trash size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: MI PERFIL (Proveedor)
// ═══════════════════════════════════════════════════════════════════

function ViewMiPerfil() {
  const v = seedVendors[0];
  return (
    <div className="view-content">
      <div className="section-head">
        <div className="section-eyebrow">Perfil Corporativo</div>
        <div className="section-title">Mi Empresa</div>
      </div>
      <div className="grid-2-1">
        <div className="card card-accent-teal">
          <div style={{display:"flex",gap:16,marginBottom:20}}>
            <div style={{width:56,height:56,borderRadius:"var(--r-lg)",background:"linear-gradient(135deg,var(--c-teal-600),var(--c-teal-800))",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Factory size={26} weight="fill" color="white"/>
            </div>
            <div>
              <div style={{fontFamily:"var(--ff-head)",fontSize:18,fontWeight:700}}>{v.name}</div>
              <div style={{fontSize:12,color:"var(--text-muted)",marginTop:3}}>RUT {v.rut} · {v.type}</div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <span className={`ice-badge ice-${v.iceLevel}`}>ICE-{v.iceLevel}</span>
                <span className={`pill ${complianceClass(v.compliance)}`}><span className="pill-dot"/>{v.compliance}</span>
              </div>
            </div>
          </div>
          <div className="divider"/>
          {[
            {label:"Servicio principal",  value:v.service},
            {label:"Región de operación", value:v.region},
            {label:"Trabajadores activos",value:`${v.workers}`},
            {label:"Score de cumplimiento",value:`${v.score}/100`},
          ].map(f => (
            <div key={f.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
              <span style={{color:"var(--text-muted)"}}>{f.label}</span>
              <strong>{f.value}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>Score Detallado</div>
          <div className="total-score-ring" style={{marginBottom:16}}>
            <div style={{fontSize:10,fontFamily:"var(--ff-mono)",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Score Total</div>
            <div className="total-score-num">{v.score}</div>
            <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:4}}>/100</div>
          </div>
          <div className="score-list">
            {[["HSE",v.score],["Calidad",v.score-5],["Financiero",v.score-10],["Ambiental",v.score-3]].map(([l,s]) => (
              <div key={l} className="score-item">
                <span className="score-label">{l}</span>
                <div className="score-track"><div className="score-fill" style={{width:`${s}%`}}/></div>
                <span className="score-val">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: MANDANTES (Admin)
// ═══════════════════════════════════════════════════════════════════

function ViewMandantes() {
  const mandantes = [
    { name:"Codelco División Norte", rut:"61.704.000-1", sector:"Minería", faenas:4, vendors:42, plan:"Enterprise", mrr:8500 },
    { name:"MOP Dirección de Vialidad",rut:"61.000.500-6", sector:"Infraestructura",faenas:7,vendors:63, plan:"Business", mrr:2490 },
    { name:"Enap Refinería Biobío",  rut:"70.240.000-2", sector:"Energía",  faenas:2,vendors:21, plan:"Profesional",mrr:990  },
    { name:"SQM Litio",              rut:"93.007.000-9", sector:"Minería",  faenas:3,vendors:35, plan:"Business",  mrr:2490 },
    { name:"Enel Chile",             rut:"94.271.000-3", sector:"Energía",  faenas:5,vendors:58, plan:"Enterprise", mrr:8500 },
  ];
  const totalMrr = mandantes.reduce((s,m) => s+m.mrr, 0);

  return (
    <div className="view-content">
      <div className="section-head" style={{display:"flex",justifyContent:"space-between"}}>
        <div>
          <div className="section-eyebrow">CRM Mandantes</div>
          <div className="section-title">Clientes (Mandantes)</div>
          <div className="section-subtitle">MRR total: <strong>${fmt(totalMrr)} USD/mes</strong></div>
        </div>
        <button className="btn btn-primary"><Plus size={14}/> Nuevo Mandante</button>
      </div>
      <div className="card" style={{padding:0}}>
        <div className="table-wrap" style={{border:"none"}}>
          <table className="data-table">
            <thead><tr><th>Mandante</th><th>Sector</th><th>Faenas</th><th>Proveedores</th><th>Plan</th><th>MRR (USD)</th></tr></thead>
            <tbody>
              {mandantes.map(m => (
                <tr key={m.name}>
                  <td><strong>{m.name}</strong><small>{m.rut}</small></td>
                  <td><span className="pill teal">{m.sector}</span></td>
                  <td><span className="text-mono fw-700">{m.faenas}</span></td>
                  <td><span className="text-mono fw-700">{m.vendors}</span></td>
                  <td><span className={`pill ${m.plan==="Enterprise"?"gold":m.plan==="Business"?"teal":"blue"}`}>{m.plan}</span></td>
                  <td><span className="text-mono fw-700" style={{color:"var(--c-green-700)"}}>${fmt(m.mrr)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

function App() {
  const [role, setRole] = useState("Mandante");
  const [plan, setPlan] = useState("Profesional");
  const [activeView, setActiveView] = useState("dashboard");

  // Reset to dashboard when role changes
  useEffect(() => { setActiveView("dashboard"); }, [role]);

  const navItems = ROLE_VIEWS[role] || ROLE_VIEWS.Mandante;

  const renderView = () => {
    const props = { role, plan };
    switch (activeView) {
      case "dashboard":      return <ViewDashboard {...props} />;
      case "oportunidades":  return <ViewOportunidades {...props} />;
      case "proveedores":    return <ViewProveedores {...props} />;
      case "matching":       return <ViewMatching {...props} />;
      case "hse":            return <ViewHSE {...props} />;
      case "ambiental":      return <ViewAmbiental {...props} />;
      case "riesgos":        return <ViewHSE {...props} />;
      case "auditoria":      return <ViewAuditoria {...props} />;
      case "mi-perfil":      return <ViewMiPerfil {...props} />;
      case "documentos":     return <ViewProveedores {...props} />;
      case "contratos":      return <ViewOportunidades {...props} />;
      case "cumplimiento":   return <ViewAmbiental {...props} />;
      case "mandantes":      return <ViewMandantes {...props} />;
      case "planes":         return <ViewPlanes {...props} />;
      case "api":            return <ViewApiKeys {...props} />;
      default:               return <ViewDashboard {...props} />;
    }
  };

  return (
    <div className="app-frame">
      <Sidebar
        role={role}
        activeView={activeView}
        setView={setActiveView}
        plan={plan}
      />
      <div className="main-container">
        <Topbar
          role={role} setRole={setRole}
          plan={plan} setPlan={setPlan}
          activeView={activeView}
          navItems={navItems}
        />
        <div className="view-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${role}-${activeView}`}
              initial={{ opacity:0, y:8 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.2, ease:"easeOut" }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════════════════════════
createRoot(document.getElementById("root")).render(<App />);
