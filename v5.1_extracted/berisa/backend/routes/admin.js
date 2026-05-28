'use strict';
/** Admin module — tenants, users, tenant limits */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireAdmin, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// All admin routes require superadmin (org admin of platform org)
const superAdmin = requireRole('admin');

// GET /admin/tenants
router.get('/tenants', superAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.id,o.name,o.slug,o.plan,o.plan_status,o.trial_ends_at,o.created_at,
              COUNT(u.id) as user_count,
              tl.max_users,tl.feature_compliance,tl.feature_finance,tl.feature_api
       FROM organizations o
       LEFT JOIN users u ON u.org_id=o.id AND u.is_active=true
       LEFT JOIN tenant_limits tl ON tl.org_id=o.id
       WHERE o.id != $1
       GROUP BY o.id,tl.max_users,tl.feature_compliance,tl.feature_finance,tl.feature_api
       ORDER BY o.created_at DESC LIMIT 100`,
      [req.org.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

// POST /admin/tenants — create new tenant
router.post('/tenants', superAdmin, async (req, res, next) => {
  try {
    const { name, plan='starter', admin_email, admin_name, admin_password } = req.body;
    if (!name || !admin_email || !admin_password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,60) + '-' + require('uuid').v4().slice(0,6);
    const { withTransaction } = require('../db/pool');
    const hash = await bcrypt.hash(admin_password, 12);
    const trialEnd = new Date(Date.now() + 14*864e5);
    const result = await withTransaction(async c => {
      const o = await c.query("INSERT INTO organizations(name,slug,plan,plan_status,trial_ends_at) VALUES($1,$2,$3,'trial',$4) RETURNING id",[name,slug,plan,trialEnd]);
      const u = await c.query("INSERT INTO users(org_id,email,password_hash,name,role) VALUES($1,$2,$3,$4,'admin') RETURNING id,name,email",[o.rows[0].id,admin_email.toLowerCase(),hash,admin_name||admin_email]);
      await c.query("INSERT INTO onboarding_progress(org_id) VALUES($1)",[o.rows[0].id]);
      await c.query("INSERT INTO tenant_limits(org_id) VALUES($1)",[o.rows[0].id]);
      return { org: o.rows[0], user: u.rows[0] };
    });
    res.status(201).json({ ...result, trialEndsAt: trialEnd });
  } catch(err) { next(err); }
});

// GET /admin/users — list all users across tenants (platform admin)
router.get('/users', superAdmin, async (req, res, next) => {
  try {
    const { org_id, role, status } = req.query;
    const conds = ['u.org_id != $1'], vals = [req.org.id]; let i = 2;
    if (org_id) { conds.push(`u.org_id=$${i++}`); vals.push(org_id); }
    if (role)   { conds.push(`u.role=$${i++}`);   vals.push(role); }
    if (status === 'active')   conds.push('u.is_active=true');
    if (status === 'inactive') conds.push('u.is_active=false');
    const { rows } = await query(
      `SELECT u.id,u.name,u.email,u.role,u.is_active,u.last_login_at,u.created_at,
              o.name as org_name,o.plan
       FROM users u JOIN organizations o ON o.id=u.org_id
       WHERE ${conds.join(' AND ')} ORDER BY u.created_at DESC LIMIT 200`, vals
    );
    res.json(rows);
  } catch(err) { next(err); }
});

// PATCH /admin/users/:id/approve
router.patch('/users/:id/approve', superAdmin, async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE users SET is_active=true WHERE id=$1 RETURNING id,name,email,is_active",[req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ...rows[0], message: 'Usuario aprobado' });
  } catch(err) { next(err); }
});

// PATCH /admin/users/:id/block
router.patch('/users/:id/block', superAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    await query("UPDATE users SET is_active=false WHERE id=$1",[req.params.id]);
    await query("UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1",[req.params.id]);
    res.json({ blocked: true, reason: reason||null });
  } catch(err) { next(err); }
});

// GET /admin/limits/:orgId — get tenant limits
router.get('/limits/:orgId', superAdmin, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM tenant_limits WHERE org_id=$1',[req.params.orgId]);
    res.json(rows[0] || {});
  } catch(err) { next(err); }
});

// PATCH /admin/limits/:orgId — update tenant limits
router.patch('/limits/:orgId', superAdmin, async (req, res, next) => {
  try {
    const cols = ['max_users','max_projects','max_alerts','max_api_calls_day','max_reports_month',
                  'max_suppliers','feature_bom','feature_crm','feature_api','feature_compliance','feature_finance'];
    const f=[],v=[]; let i=1;
    for(const k of cols) if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    if(!f.length) return res.status(400).json({ error: 'Sin campos' });
    v.push(req.params.orgId);
    await query(`INSERT INTO tenant_limits(org_id) VALUES($${i}) ON CONFLICT(org_id) DO UPDATE SET ${f.join(',')},updated_at=NOW()`, v);
    res.json({ updated: true });
  } catch(err) { next(err); }
});

// GET /admin/stats — platform overview
router.get('/stats', superAdmin, async (req, res, next) => {
  try {
    const { rows:[s] } = await query(
      `SELECT
        (SELECT COUNT(*) FROM organizations WHERE id!=$1) as total_orgs,
        (SELECT COUNT(*) FROM organizations WHERE plan_status='active') as active_subs,
        (SELECT COUNT(*) FROM organizations WHERE plan_status='trial') as trials,
        (SELECT COUNT(*) FROM users WHERE is_active=true) as total_users,
        (SELECT COUNT(*) FROM projects WHERE is_active=true) as total_projects,
        (SELECT COUNT(*) FROM suppliers) as total_suppliers,
        (SELECT COUNT(*) FROM opportunities) as total_opps`,
      [req.org.id]
    );
    res.json(s);
  } catch(err) { next(err); }
});

module.exports = router;
