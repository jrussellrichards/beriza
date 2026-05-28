'use strict';
/** Private integrations framework */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

const ENC_KEY = (process.env.ENCRYPTION_KEY || 'berisa_enc_key_32bytes_change_me').slice(0,32);

function encryptConfig(obj) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENC_KEY), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}
function decryptConfig(str) {
  try {
    const [ivHex, encHex] = str.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENC_KEY), Buffer.from(ivHex,'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex,'hex')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch { return {}; }
}

router.get('/catalog', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id,code,name,category,logo_url,description,auth_type FROM integration_catalog WHERE is_active=true ORDER BY category,name');
    res.json(rows);
  } catch(err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ti.id,ti.is_active,ti.last_sync,ti.sync_status,ti.created_at,
              ic.code,ic.name,ic.category,ic.auth_type
       FROM tenant_integrations ti
       JOIN integration_catalog ic ON ic.id=ti.catalog_id
       WHERE ti.org_id=$1 ORDER BY ic.category,ic.name`, [req.org.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { catalog_id, config={} } = req.body;
    if(!catalog_id) return res.status(400).json({ error: 'catalog_id requerido' });
    const enc = encryptConfig(config);
    const { rows:[ti] } = await query(
      'INSERT INTO tenant_integrations(org_id,catalog_id,config_enc) VALUES($1,$2,$3) ON CONFLICT(org_id,catalog_id) DO UPDATE SET config_enc=$3,updated_at=NOW() RETURNING id,org_id,catalog_id,is_active,created_at',
      [req.org.id, catalog_id, enc]
    );
    res.status(201).json(ti);
  } catch(err) { next(err); }
});

router.patch('/:id/toggle', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE tenant_integrations SET is_active=NOT is_active WHERE id=$1 AND org_id=$2 RETURNING id,is_active',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({ error: 'Integración no encontrada' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

router.post('/:id/sync', requireAdmin, async (req, res, next) => {
  try {
    // Placeholder sync — in production: call OAuth/API
    await query("UPDATE tenant_integrations SET last_sync=NOW(),sync_status='syncing' WHERE id=$1 AND org_id=$2",[req.params.id,req.org.id]);
    await query("INSERT INTO integration_events(org_id,integration_id,event_type,status) VALUES($1,$2,'sync','initiated')",[req.org.id,req.params.id]);
    setTimeout(async()=>{
      try{ await require('../db/pool').query("UPDATE tenant_integrations SET sync_status='idle' WHERE id=$1",[req.params.id]); }catch{}
    },2000);
    res.json({ syncing: true, message: 'Sincronización iniciada. El estado se actualizará en segundos.' });
  } catch(err) { next(err); }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM integration_events WHERE integration_id=$1 AND org_id=$2 ORDER BY created_at DESC LIMIT 50',[req.params.id,req.org.id]);
    res.json(rows);
  } catch(err) { next(err); }
});

module.exports = router;
