'use strict';
const { Pool } = require('pg');
const pool = new Pool({
  host:process.env.DB_HOST||'localhost', port:parseInt(process.env.DB_PORT||'5432'),
  database:process.env.DB_NAME||'berisa_db', user:process.env.DB_USER||'berisa_user',
  password:process.env.DB_PASSWORD, ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:false,
  min:2, max:20, idleTimeoutMillis:30000, connectionTimeoutMillis:5000,
});
pool.on('error',err=>console.error('[DB]',err.message));
async function query(sql,params=[]){const c=await pool.connect();try{return await c.query(sql,params);}finally{c.release();}}
async function withTransaction(fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
module.exports={pool,query,withTransaction};
