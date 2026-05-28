import { useEffect, useMemo, useState } from "react";
import { api, setTenantId, getTenantId } from "./api.js";

const stages = [
  ["prospecto", "Prospecto"],
  ["calificacion", "Calificación"],
  ["contactado", "Contactado"],
  ["propuesta", "Propuesta"],
  ["negociacion", "Negociación"],
  ["ganado", "Ganado"],
  ["perdido", "Perdido"]
];

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (Math.abs(n) >= 1000000) return `USD ${(n / 1000000).toFixed(1)} M`;
  if (Math.abs(n) >= 1000) return `USD ${(n / 1000).toFixed(1)} K`;
  return `USD ${n.toFixed(0)}`;
}

function moneyMusd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n >= 1000) return `USD ${(n / 1000).toFixed(1)} B`;
  return `USD ${n.toFixed(1)} M`;
}

function scoreStars(score) {
  return "★★★★★".slice(0, score || 0) || "—";
}

function Badge({ children, type = "neutral" }) {
  return <span className={`badge ${type}`}>{children}</span>;
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{hint}</span>
    </div>
  );
}

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: form.email, password: form.password }) });
        setTenantId(data.user.currentTenant?.id || data.user.tenants?.[0]?.id || null);
        onLogin(data.user);
      } else {
        const data = await api("/auth/register", { method: "POST", body: JSON.stringify(form) });
        setMessage(data.verificationToken ? `Usuario creado. Token de verificación local: ${data.verificationToken}` : data.message);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <img src="/berisa-logo.svg" className="auth-logo" alt="Berisa" />
        <h1>Inteligencia comercial para proyectos de inversión</h1>
        <p>Acceso seguro, multi-tenant, pipeline comercial, trazabilidad de fuentes, alertas, BOM y ROI.</p>
        <div className="auth-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Ingresar</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Solicitar usuario</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>}
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Contraseña<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={12} /></label>
          <button className="primary" type="submit">{mode === "login" ? "Ingresar" : "Crear solicitud"}</button>
        </form>
        {message && <div className="notice ok">{message}</div>}
        {error && <div className="notice error">{error}</div>}
      </section>
    </main>
  );
}

function Header({ user, tab, setTab, logout, onTenantChange }) {
  const showAdmin = user?.role === "platform_admin" || ["owner", "admin"].includes(user?.currentTenant?.tenantRole);
  const tabs = [
    ["dashboard", "Dashboard"],
    ["pipeline", "Pipeline"],
    ["plan", "Plan comercial"],
    ["alerts", "Alertas"],
    ...(showAdmin ? [["users", "Usuarios"], ["privacy", "Privacidad"]] : [])
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/berisa-logo.svg" alt="Berisa" />
        <div><strong>Plataforma Comercial</strong><span>Datos · Pipeline · BOM · ROI</span></div>
      </div>
      <nav>{tabs.map(([key, label]) => <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <div className="session">
        {user?.tenants?.length > 0 && (
          <select value={getTenantId() || user.tenants[0].id} onChange={(e) => { setTenantId(e.target.value); onTenantChange(); }}>
            {user.tenants.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}
          </select>
        )}
        <span>{user?.name}</span><Badge>{user?.role}</Badge><button onClick={logout}>Salir</button>
      </div>
    </header>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [facets, setFacets] = useState({ sectors: [], statuses: [], countries: [], regions: [] });
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ q: "", sector: "", status: "", country: "", opportunity: "", minScore: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [bomResult, setBomResult] = useState(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters, page]);

  function load() {
    setError("");
    api("/projects/summary").then(setSummary).catch((err) => setError(err.message));
    api("/projects/facets").then(setFacets).catch((err) => setError(err.message));
    api(`/projects?${qs}`).then((data) => { setProjects(data.projects); setTotal(data.total); }).catch((err) => setError(err.message));
  }

  useEffect(load, [qs]);
  function change(key, value) { setFilters({ ...filters, [key]: value }); setPage(1); }

  async function estimateBom(projectId) {
    setBomResult(null);
    try {
      const data = await api(`/bom/projects/${projectId}/estimate`, { method: "POST", body: JSON.stringify({}) });
      setBomResult(data.estimate);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page">
      <div className="hero">
        <div><h1>Berisa · Inteligencia Comercial</h1><p>Pipeline de proyectos con trazabilidad de datos, priorización y activación comercial.</p></div>
        <div className="hero-box"><span>Base inicial</span><strong>{summary ? summary.projects.toLocaleString("es-CL") : "—"}</strong><small>proyectos cargados</small></div>
      </div>
      <div className="kpi-grid">
        <Kpi label="Inversión total" value={moneyMusd(summary?.investment_musd)} hint="monto agregado" />
        <Kpi label="Alta relevancia" value={summary?.high_relevance ?? "—"} hint="score ≥ 4" />
        <Kpi label="Accionables ahora" value={summary?.actionable_now ?? "—"} hint="ventana activa" />
        <Kpi label="Geolocalizados" value={summary?.geolocated ?? "—"} hint="base para alertas" />
        <Kpi label="Fuentes vinculadas" value={summary?.lineage?.sources ?? "—"} hint="trazabilidad" />
        <Kpi label="Links de fuente" value={summary?.lineage?.source_links ?? "—"} hint="project_sources" />
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Filtro de oportunidades</h2><button onClick={() => { setFilters({ q: "", sector: "", status: "", country: "", opportunity: "", minScore: "" }); setPage(1); }}>Limpiar</button></div>
        <div className="filters">
          <input placeholder="Buscar proyecto, mandante o descripción" value={filters.q} onChange={(e) => change("q", e.target.value)} />
          <select value={filters.sector} onChange={(e) => change("sector", e.target.value)}><option value="">Todos los sectores</option>{facets.sectors.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.status} onChange={(e) => change("status", e.target.value)}><option value="">Todos los estados</option>{facets.statuses.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.country} onChange={(e) => change("country", e.target.value)}><option value="">Todos los países</option>{facets.countries.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.opportunity} onChange={(e) => change("opportunity", e.target.value)}><option value="">Toda ventana</option><option value="green">Accionable ahora</option><option value="yellow">Preparación</option><option value="red">Prospección</option></select>
          <select value={filters.minScore} onChange={(e) => change("minScore", e.target.value)}><option value="">Toda relevancia</option><option value="5">5 estrellas</option><option value="4">4+ estrellas</option><option value="3">3+ estrellas</option></select>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {bomResult && (
        <div className="notice ok">
          BOM preliminar generado con confianza {bomResult.confidence}%. {bomResult.items?.slice(0, 4).map((item) => `${item.itemName}: ${item.quantity} ${item.unit}`).join(" · ")}
        </div>
      )}
      <div className="panel">
        <div className="panel-title"><h2>Pipeline de proyectos</h2><span>{total.toLocaleString("es-CL")} resultados</span></div>
        <div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Sector</th><th>Ubicación</th><th>Inversión</th><th>Relevancia</th><th>Ventana</th><th>BOM</th></tr></thead><tbody>
          {projects.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.ownerName || "Mandante no informado"}</small></td><td>{p.sector || "—"}</td><td>{[p.region, p.country].filter(Boolean).join(" · ") || "—"}</td><td>{moneyMusd(p.investmentMusd)}</td><td><span className="stars">{scoreStars(p.score)}</span></td><td><Badge type={p.opportunityStatus || "neutral"}>{p.opportunityLabel || "—"}</Badge></td><td><button onClick={() => estimateBom(p.id)}>Estimar</button></td></tr>)}
        </tbody></table></div>
        <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} · {Math.ceil(total / 25) || 1}</span><button disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(page + 1)}>Siguiente</button></div>
      </div>
    </section>
  );
}

function Pipeline() {
  const [summary, setSummary] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  function load() {
    api("/pipeline/summary").then(setSummary).catch((err) => setError(err.message));
    api(`/pipeline/opportunities?pageSize=100${stage ? `&stage=${stage}` : ""}`).then((data) => setOpportunities(data.opportunities)).catch((err) => setError(err.message));
  }
  useEffect(load, [stage]);
  async function move(opp, nextStage) { try { await api(`/pipeline/opportunities/${opp.id}`, { method: "PATCH", body: JSON.stringify({ stage: nextStage }) }); load(); } catch (err) { setError(err.message); } }
  return <section className="page"><div className="page-head"><h1>Pipeline comercial multi-tenant</h1><p>Oportunidades aisladas por empresa cliente, con valor ponderado y registro ROI automático al ganar.</p></div>{error && <div className="notice error">{error}</div>}<div className="stage-summary">{stages.map(([key, label]) => <button key={key} className={stage === key ? "on" : ""} onClick={() => setStage(stage === key ? "" : key)}><span>{label}</span><strong>{summary?.stages?.[key]?.count ?? 0}</strong><small>{moneyMusd(summary?.stages?.[key]?.weightedValueMusd ?? 0)} ponderado</small></button>)}</div><div className="cards">{opportunities.map((opp) => <article className="opp-card" key={opp.id}><div className="opp-head"><Badge type={opp.stage}>{stages.find(([key]) => key === opp.stage)?.[1] || opp.stage}</Badge><span>{opp.probability}%</span></div><h3>{opp.project.name}</h3><p>{opp.project.ownerName || "Mandante no informado"}</p><div className="opp-meta"><span>{opp.project.sector || "—"}</span><span>{moneyMusd(opp.valueMusd)}</span><span>{scoreStars(opp.project.score)}</span></div><small>Próxima acción: {opp.nextActionDate || "sin fecha"}</small><div className="opp-actions">{stages.slice(0, 6).map(([key, label]) => <button key={key} disabled={key === opp.stage} onClick={() => move(opp, key)}>{label}</button>)}</div></article>)}</div></section>;
}

function CommercialPlan() {
  const [roi, setRoi] = useState(null);
  const [sources, setSources] = useState([]);
  const [runs, setRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function load() {
    setError("");
    api("/roi/summary").then(setRoi).catch((err) => setError(err.message));
    api("/ingestion/sources").then((d) => setSources(d.sources)).catch((err) => setError(err.message));
    api("/ingestion/runs?limit=10").then((d) => setRuns(d.runs)).catch(() => {});
    api("/alerts/events?limit=10").then((d) => setAlerts(d.events)).catch(() => {});
    api("/bom/assumptions").then((d) => setAssumptions(d.assumptions)).catch(() => {});
  }
  useEffect(load, []);
  async function runDue() { try { const r = await api("/ingestion/run-due", { method: "POST", body: JSON.stringify({}) }); setMessage(`Ingestión evaluada: ${r.results.length} fuente(s).`); load(); } catch (err) { setError(err.message); } }
  async function evalAlerts() { try { const r = await api("/alerts/evaluate", { method: "POST", body: JSON.stringify({}) }); setMessage(`Alertas evaluadas: ${r.result.eventsCreated} eventos nuevos.`); load(); } catch (err) { setError(err.message); } }
  return <section className="page"><div className="page-head"><h1>Plan comercial · capacidades críticas</h1><p>Vista de control para las 7 brechas críticas priorizadas: fuentes, licencias, multi-tenant, alertas, BOM, privacidad y ROI.</p></div>{message && <div className="notice ok">{message}</div>}{error && <div className="notice error">{error}</div>}<div className="kpi-grid"><Kpi label="ROI medido" value={roi?.economics?.roiPercent === null ? "s/i" : `${roi?.economics?.roiPercent ?? "—"}%`} hint="valor vs costo" /><Kpi label="Pipeline ponderado" value={moneyMusd(roi?.pipeline?.weighted_pipeline_musd)} hint="por tenant" /><Kpi label="Valor creado" value={money(roi?.economics?.measuredValueCreatedUsd)} hint="eventos ROI" /><Kpi label="Fuentes" value={sources.length} hint="registradas" /><Kpi label="BOM supuestos" value={assumptions.length} hint="activos/draft" /><Kpi label="Alertas recientes" value={alerts.length} hint="eventos" /></div><div className="grid-2"><div className="panel"><div className="panel-title"><h2>Ingestión y licencias</h2><button onClick={runDue}>Ejecutar fuentes vencidas</button></div><div className="table-wrap"><table><thead><tr><th>Fuente</th><th>Licencia</th><th>Registros</th><th>Próxima ejecución</th></tr></thead><tbody>{sources.map((s) => <tr key={s.id}><td><strong>{s.name}</strong><small>{s.source_key}</small></td><td><Badge type={s.license_status}>{s.license_status}</Badge></td><td>{s.records}</td><td>{s.next_run_at ? new Date(s.next_run_at).toLocaleString("es-CL") : "manual"}</td></tr>)}</tbody></table></div></div><div className="panel"><div className="panel-title"><h2>Alertas comerciales</h2><button onClick={evalAlerts}>Evaluar ahora</button></div>{alerts.map((a) => <div className="mini-card" key={a.id}><strong>{a.title}</strong><span>{a.body}</span></div>)}{!alerts.length && <p className="muted">Sin eventos recientes. Ejecuta evaluación de alertas.</p>}</div></div><div className="grid-2"><div className="panel"><div className="panel-title"><h2>ROI del cliente</h2></div><p className="muted">Costo mensual: {money(roi?.economics?.monthlySubscriptionCostUsd)} · Costo medido total: {money(roi?.economics?.totalMeasuredCostUsd)} · Valor creado: {money(roi?.economics?.measuredValueCreatedUsd)}</p></div><div className="panel"><div className="panel-title"><h2>Últimas ingestiones</h2></div>{runs.map((r) => <div className="mini-card" key={r.id}><strong>{r.source_name}</strong><span>{r.status} · vistos {r.records_seen} · cargados {r.records_upserted}</span></div>)}</div></div></section>;
}

function Alerts() {
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ name: "", sector: "", region: "", opportunityStatus: "green", minScore: 4 });
  const [error, setError] = useState("");
  function load() { api("/alerts/rules").then((d) => setRules(d.rules)).catch((e) => setError(e.message)); api("/alerts/events?limit=50").then((d) => setEvents(d.events)).catch(() => {}); }
  useEffect(load, []);
  async function create(e) { e.preventDefault(); try { await api("/alerts/rules", { method: "POST", body: JSON.stringify({ ...form, minScore: Number(form.minScore), sector: form.sector || null, region: form.region || null, opportunityStatus: form.opportunityStatus || null }) }); setForm({ name: "", sector: "", region: "", opportunityStatus: "green", minScore: 4 }); load(); } catch (err) { setError(err.message); } }
  return <section className="page"><div className="page-head"><h1>Alertas geolocalizadas y por sector</h1><p>Reglas por ventana comercial, sector, región, score mínimo e inversión.</p></div>{error && <div className="notice error">{error}</div>}<div className="grid-2"><div className="panel"><div className="panel-title"><h2>Nueva alerta</h2></div><form className="filters" onSubmit={create}><input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input placeholder="Sector opcional" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /><input placeholder="Región opcional" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /><select value={form.opportunityStatus} onChange={(e) => setForm({ ...form, opportunityStatus: e.target.value })}><option value="green">Accionable</option><option value="yellow">Preparación</option><option value="red">Prospección</option><option value="">Cualquiera</option></select><input type="number" min="1" max="5" value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })} /><button className="primary">Crear regla</button></form><h3>Reglas</h3>{rules.map((r) => <div className="mini-card" key={r.id}><strong>{r.name}</strong><span>{[r.sector, r.region, r.opportunity_status, `score ≥ ${r.min_score || "—"}`].filter(Boolean).join(" · ")}</span></div>)}</div><div className="panel"><div className="panel-title"><h2>Eventos</h2></div>{events.map((e) => <div className="mini-card" key={e.id}><strong>{e.title}</strong><span>{e.body}</span></div>)}</div></div></section>;
}

function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  function load() { api("/admin/users").then((data) => setUsers(data.users)).catch((err) => setError(err.message)); }
  useEffect(load, []);
  async function approve(user, role) { try { await api(`/admin/users/${user.id}/approve`, { method: "PATCH", body: JSON.stringify({ role }) }); load(); } catch (err) { setError(err.message); } }
  async function block(user) { try { await api(`/admin/users/${user.id}/block`, { method: "PATCH" }); load(); } catch (err) { setError(err.message); } }
  return <section className="page"><div className="page-head"><h1>Usuarios validados</h1><p>Control de acceso por estado, rol de plataforma y membresía tenant.</p></div>{error && <div className="notice error">{error}</div>}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Tenants</th><th>Acciones</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td><strong>{u.name}</strong><small>{new Date(u.created_at).toLocaleDateString("es-CL")}</small></td><td>{u.email}</td><td>{u.role}</td><td><Badge type={u.status}>{u.status}</Badge></td><td>{u.tenants?.map((t) => t.name).join(", ") || "—"}</td><td className="row-actions">{["viewer", "analyst", "commercial", "tenant_admin"].map((role) => <button key={role} onClick={() => approve(u, role)}>{role}</button>)}<button onClick={() => block(u)}>Bloquear</button></td></tr>)}</tbody></table></div></div></section>;
}

function Privacy() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  function load() { api("/privacy/requests?limit=100").then((d) => setRequests(d.requests)).catch((e) => setError(e.message)); }
  useEffect(load, []);
  async function resolve(r, redactContact = false) { try { await api(`/privacy/requests/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved", resolutionNotes: redactContact ? "Contacto redactado por solicitud." : "Solicitud resuelta.", redactContact }) }); load(); } catch (e) { setError(e.message); } }
  return <section className="page"><div className="page-head"><h1>Gobierno de datos personales</h1><p>Solicitudes de titulares, redacción de contactos y auditoría de privacidad.</p></div>{error && <div className="notice error">{error}</div>}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Contacto</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{requests.map((r) => <tr key={r.id}><td>{r.request_type}</td><td><strong>{r.subject_name || "—"}</strong><small>{r.subject_email || r.subject_phone || r.contact_hash}</small></td><td><Badge type={r.status}>{r.status}</Badge></td><td>{new Date(r.received_at).toLocaleDateString("es-CL")}</td><td><button onClick={() => resolve(r, false)}>Resolver</button><button onClick={() => resolve(r, true)}>Redactar</button></td></tr>)}</tbody></table></div></div></section>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { api("/auth/me").then((data) => { if (data.tenant?.id) setTenantId(data.tenant.id); setUser({ ...data.user, currentTenant: data.tenant }); }).catch(() => { setTenantId(null); setUser(null); }); }, [refreshKey]);
  if (!user) return <Login onLogin={setUser} />;
  const showAdmin = user?.role === "platform_admin" || ["owner", "admin"].includes(user?.currentTenant?.tenantRole);
  async function logout() { try { await api("/auth/logout", { method: "POST", body: JSON.stringify({}) }); } catch {} setTenantId(null); setUser(null); }
  return <><Header user={user} tab={tab} setTab={setTab} logout={logout} onTenantChange={() => setRefreshKey((x) => x + 1)} />{tab === "dashboard" && <Dashboard />}{tab === "pipeline" && <Pipeline />}{tab === "plan" && <CommercialPlan />}{tab === "alerts" && <Alerts />}{tab === "users" && showAdmin && <Users />}{tab === "privacy" && showAdmin && <Privacy />}</>;
}
