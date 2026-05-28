/**
 * BERISA API Client v4.0
 * Replaces berisa-data.js static data with real /api/v1/ calls
 * Falls back to demo data when API is unavailable (dev mode)
 */
;(function(g) {
'use strict';

const API_BASE = (window.BERISA_API_URL || '') + '/api/v1';

// ── Auth helpers ──────────────────────────────────────────
function getToken() { return sessionStorage.getItem('berisa_token'); }
function getHeaders(extra={}) {
  return { 'Content-Type':'application/json', 'Authorization':'Bearer '+getToken(), ...extra };
}

// ── Core fetch wrapper ────────────────────────────────────
async function apiFetch(path, opts={}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: getHeaders(),
      ...opts,
    });
    if (res.status === 401) {
      sessionStorage.setItem('berisa_logout_reason','Sesión expirada. Por favor inicie sesión nuevamente.');
      window.location.replace('/index.html');
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`[API] ${path} error:`, err.message);
    return null; // Fall through to demo data
  }
}

// ── Projects ──────────────────────────────────────────────
async function getProjects(params={}) {
  const qs = new URLSearchParams(params).toString();
  const data = await apiFetch('/projects' + (qs ? '?'+qs : ''));
  if (data) return data;
  // Fallback to demo data
  return typeof BD !== 'undefined' ? { data: BD.PROJECTS, meta: { total: BD.PROJECTS.length, page:1 } } : { data:[], meta:{total:0,page:1} };
}

async function getProject(id) {
  const data = await apiFetch('/projects/'+id);
  if (data) return data;
  return typeof BD !== 'undefined' ? BD.PROJECTS.find(p=>p.id===id) || null : null;
}

async function getProjectFilters() {
  const data = await apiFetch('/projects/meta/filters');
  if (data) return data;
  if (typeof BD !== 'undefined') {
    return {
      sectors:   [...new Set(BD.PROJECTS.map(p=>p.s).filter(Boolean))].sort(),
      statuses:  [...new Set(BD.PROJECTS.map(p=>p.status).filter(Boolean))].sort(),
      countries: ['CL','PE','CO'],
      regions:   [...new Set(BD.PROJECTS.map(p=>p.region).filter(Boolean))].sort(),
    };
  }
  return { sectors:[], statuses:[], countries:[], regions:[] };
}

async function saveProject(id) {
  return apiFetch('/projects/'+id+'/save', { method:'POST', body:'{}' });
}

// ── Alerts ────────────────────────────────────────────────
async function getAlertRules() {
  return await apiFetch('/alerts') || [];
}
async function createAlertRule(rule) {
  return apiFetch('/alerts', { method:'POST', body: JSON.stringify(rule) });
}
async function getAlertEvents(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/alerts/events'+(qs?'?'+qs:'')) || { data:[], unreadCount:0 };
}
async function markAlertRead(id) {
  return apiFetch('/alerts/events/'+id+'/read', { method:'POST', body:'{}' });
}

// ── CRM ───────────────────────────────────────────────────
async function getOpportunities(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/crm/opportunities'+(qs?'?'+qs:'')) || { data:[], pipeline:[] };
}
async function createOpportunity(opp) {
  return apiFetch('/crm/opportunities', { method:'POST', body: JSON.stringify(opp) });
}
async function updateOpportunity(id, data) {
  return apiFetch('/crm/opportunities/'+id, { method:'PATCH', body: JSON.stringify(data) });
}
async function getContacts(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/crm/contacts'+(qs?'?'+qs:'')) || [];
}
async function createContact(contact) {
  return apiFetch('/crm/contacts', { method:'POST', body: JSON.stringify(contact) });
}

// ── Analytics ─────────────────────────────────────────────
async function getAnalyticsSummary() {
  return await apiFetch('/analytics/summary') || { pipeline:{}, projects:{}, alerts:{}, activities:{} };
}
async function getStageFunnel() {
  return await apiFetch('/analytics/stage-funnel') || [];
}
async function getTeamPerformance() {
  return await apiFetch('/analytics/team-performance') || [];
}

// ── Suppliers ─────────────────────────────────────────────
async function getSuppliers(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/suppliers'+(qs?'?'+qs:'')) || { data:[], meta:{total:0} };
}
async function getSupplier(id) {
  return await apiFetch('/suppliers/'+id);
}
async function createSupplier(sup) {
  return apiFetch('/suppliers', { method:'POST', body: JSON.stringify(sup) });
}
async function getHomologation(id) {
  return await apiFetch('/suppliers/'+id+'/homologation');
}
async function getCapabilityCatalog() {
  return await apiFetch('/capabilities/catalog') || { catalog:[], grouped:{} };
}
async function getSupplierScore(id) {
  return await apiFetch('/capabilities/scores/'+id);
}

// ── Demand needs (matching) ───────────────────────────────
async function getDemandNeeds(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/demand'+(qs?'?'+qs:'')) || [];
}
async function createDemandNeed(need) {
  return apiFetch('/demand', { method:'POST', body: JSON.stringify(need) });
}
async function generateMatches(needId) {
  return apiFetch('/demand/'+needId+'/generate-matches', { method:'POST', body:'{}' });
}

// ── Commercial accounts ───────────────────────────────────
async function getAccounts(params={}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch('/commercial/accounts'+(qs?'?'+qs:'')) || [];
}
async function createAccount(acc) {
  return apiFetch('/commercial/accounts', { method:'POST', body: JSON.stringify(acc) });
}

// ── ROI ───────────────────────────────────────────────────
async function getRoiSummary(period) {
  return await apiFetch('/roi/summary'+(period?'?period='+period:'')) || { events:{}, targets:{} };
}
async function createRoiEvent(ev) {
  return apiFetch('/roi/events', { method:'POST', body: JSON.stringify(ev) });
}

// ── Onboarding ────────────────────────────────────────────
async function getOnboarding() {
  return await apiFetch('/onboarding') || {};
}
async function completeOnboardingStep(step) {
  return apiFetch('/onboarding/step/'+step, { method:'POST', body:'{}' });
}

// ── RFQ ───────────────────────────────────────────────────
async function getRfqs() { return await apiFetch('/rfq') || []; }
async function createRfq(rfq) { return apiFetch('/rfq', { method:'POST', body: JSON.stringify(rfq) }); }
async function publishRfq(id) { return apiFetch('/rfq/'+id+'/publish', { method:'POST', body:'{}' }); }

// ── Privacy ───────────────────────────────────────────────
async function getPrivacyPolicy() { return await apiFetch('/privacy/policy'); }
async function submitPrivacyRequest(req) { return apiFetch('/privacy/requests', { method:'POST', body: JSON.stringify(req) }); }

// ── Reports ───────────────────────────────────────────────
async function getReports() { return await apiFetch('/reports') || []; }
async function generateReport(params) { return apiFetch('/reports/generate', { method:'POST', body: JSON.stringify(params) }); }

// ── Admin ─────────────────────────────────────────────────
async function getAdminStats() { return await apiFetch('/admin/stats'); }
async function getTenants() { return await apiFetch('/admin/tenants') || []; }
async function createTenant(t) { return apiFetch('/admin/tenants', { method:'POST', body: JSON.stringify(t) }); }

// ── Health check ──────────────────────────────────────────
async function healthCheck() {
  try {
    const res = await fetch((window.BERISA_API_URL||'') + '/health');
    return res.ok;
  } catch { return false; }
}

// ── API availability indicator ────────────────────────────
async function init() {
  const ok = await healthCheck();
  if (!ok) console.warn('[BERISA API] Backend no disponible — usando datos demo');
  return ok;
}

// ── Export ────────────────────────────────────────────────
g.BAPI = {
  // Core
  init, healthCheck,
  // Projects
  getProjects, getProject, getProjectFilters, saveProject,
  // Alerts
  getAlertRules, createAlertRule, getAlertEvents, markAlertRead,
  // CRM
  getOpportunities, createOpportunity, updateOpportunity,
  getContacts, createContact,
  // Analytics
  getAnalyticsSummary, getStageFunnel, getTeamPerformance,
  // Suppliers
  getSuppliers, getSupplier, createSupplier, getHomologation,
  getCapabilityCatalog, getSupplierScore,
  // Demand & matching
  getDemandNeeds, createDemandNeed, generateMatches,
  // Commercial
  getAccounts, createAccount,
  // ROI
  getRoiSummary, createRoiEvent,
  // Onboarding
  getOnboarding, completeOnboardingStep,
  // RFQ
  getRfqs, createRfq, publishRfq,
  // Privacy
  getPrivacyPolicy, submitPrivacyRequest,
  // Reports
  getReports, generateReport,
  // Admin
  getAdminStats, getTenants, createTenant,
};

})(window);
