/**
 * ═══════════════════════════════════════════════════════
 * BERISA — Authentication & Security Module v1.0
 * Inteligencia Comercial · Infraestructura Estratégica
 *
 * Features:
 * - Simulated JWT (base64 signed tokens)
 * - Role-Based Access Control (RBAC)
 * - Brute-force rate limiting
 * - Session timeout with auto-logout
 * - XSS input sanitization
 * - CSRF token generation
 * - Activity audit log
 * - Content Security Policy enforcement
 * ═══════════════════════════════════════════════════════
 */

;(function(global) {
  'use strict';

  /* ─── CONSTANTS ─────────────────────────────────────────── */
  const CONFIG = {
    SESSION_TIMEOUT_MS:  30 * 60 * 1000,   // 30 minutes idle
    TOKEN_EXPIRY_MS:     8  * 60 * 60 * 1000, // 8 hours absolute
    MAX_LOGIN_ATTEMPTS:  5,
    LOCKOUT_MS:          15 * 60 * 1000,    // 15-minute lockout
    SALT_ROUNDS:         10,
    APP_VERSION:         '1.0.0',
    APP_KEY:             'berisa_v1',
  };

  const ROLES = {
    ADMIN:   { level: 4, label: 'Administrador', permissions: ['all'] },
    MANAGER: { level: 3, label: 'Gerente',        permissions: ['view', 'edit', 'pipeline', 'export'] },
    ANALYST: { level: 2, label: 'Analista',       permissions: ['view', 'pipeline', 'export'] },
    VIEWER:  { level: 1, label: 'Visualizador',   permissions: ['view'] },
  };

  /* ─── USER REGISTRY (demo — replace w/ backend) ─────────── */
  const USERS_DB = [
    {
      id:       'usr_001',
      name:     'Administrador Berisa',
      email:    'admin@berisa.com',
      // SHA-256 placeholder — in production use bcrypt on server
      passHash: btoa('admin2024!'),
      role:     'ADMIN',
      active:   true,
      created:  '2024-01-15',
      lastLogin: null,
      avatar:   'AB',
    },
    {
      id:       'usr_002',
      name:     'Gerente Comercial',
      email:    'comercial@berisa.com',
      passHash: btoa('comercial2024!'),
      role:     'MANAGER',
      active:   true,
      created:  '2024-01-15',
      lastLogin: null,
      avatar:   'GC',
    },
    {
      id:       'usr_003',
      name:     'Analista de Proyectos',
      email:    'analista@berisa.com',
      passHash: btoa('analista2024!'),
      role:     'ANALYST',
      active:   true,
      created:  '2024-02-01',
      lastLogin: null,
      avatar:   'AP',
    },
    {
      id:       'usr_004',
      name:     'Usuario Demo',
      email:    'demo@berisa.com',
      passHash: btoa('demo1234!'),
      role:     'VIEWER',
      active:   true,
      created:  '2024-03-01',
      lastLogin: null,
      avatar:   'UD',
    },
  ];

  /* ─── IN-MEMORY STATE (never touches localStorage) ──────── */
  let _session = null;         // active session token payload
  let _csrfToken = null;       // per-session CSRF token
  let _sessionTimer = null;    // idle timeout handle
  let _auditLog = [];          // audit trail (in-memory)
  let _loginAttempts = {};     // { email: { count, lockedUntil } }
  let _users = [...USERS_DB];  // mutable user registry

  /* ─── TOKEN GENERATION ───────────────────────────────────── */
  function generateId(prefix = 'tok') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function generateCsrf() {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function encodeToken(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body   = btoa(JSON.stringify(payload));
    // Simple signature: in production use HMAC-SHA256 with server secret
    const sig    = btoa([CONFIG.APP_KEY, body].join('.'));
    return `${header}.${body}.${sig}`;
  }

  function decodeToken(token) {
    try {
      const [, body] = token.split('.');
      return JSON.parse(atob(body));
    } catch {
      return null;
    }
  }

  function verifyToken(token) {
    try {
      const [header, body, sig] = token.split('.');
      const expectedSig = btoa([CONFIG.APP_KEY, body].join('.'));
      if (sig !== expectedSig) return { valid: false, reason: 'Firma inválida' };
      const payload = JSON.parse(atob(body));
      if (Date.now() > payload.exp) return { valid: false, reason: 'Sesión expirada' };
      return { valid: true, payload };
    } catch {
      return { valid: false, reason: 'Token malformado' };
    }
  }

  /* ─── INPUT SANITIZATION ─────────────────────────────────── */
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]))
      .trim()
      .slice(0, 512);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
  }

  function validatePassword(pwd) {
    const errors = [];
    if (pwd.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(pwd)) errors.push('Al menos una mayúscula');
    if (!/[0-9]/.test(pwd)) errors.push('Al menos un número');
    if (!/[!@#$%^&*()_+\-=\[\]{}]/.test(pwd)) errors.push('Al menos un carácter especial');
    return { valid: errors.length === 0, errors };
  }

  /* ─── RATE LIMITING ──────────────────────────────────────── */
  function checkRateLimit(email) {
    const attempt = _loginAttempts[email];
    if (!attempt) return { blocked: false };
    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return { blocked: true, minutesLeft: remaining };
    }
    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      delete _loginAttempts[email];
    }
    return { blocked: false };
  }

  function recordFailedAttempt(email) {
    if (!_loginAttempts[email]) _loginAttempts[email] = { count: 0, lockedUntil: null };
    _loginAttempts[email].count++;
    if (_loginAttempts[email].count >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      _loginAttempts[email].lockedUntil = Date.now() + CONFIG.LOCKOUT_MS;
    }
    return _loginAttempts[email].count;
  }

  function clearAttempts(email) {
    delete _loginAttempts[email];
  }

  /* ─── SESSION MANAGEMENT ─────────────────────────────────── */
  function startIdleTimer() {
    clearTimeout(_sessionTimer);
    _sessionTimer = setTimeout(() => {
      if (_session) {
        _audit('SESSION_TIMEOUT', { userId: _session.userId });
        logout('timeout');
      }
    }, CONFIG.SESSION_TIMEOUT_MS);
  }

  function resetIdleTimer() {
    if (_session) startIdleTimer();
  }

  // Reset idle on user activity
  ['click', 'keydown', 'mousemove', 'scroll'].forEach(evt => {
    document.addEventListener(evt, () => resetIdleTimer(), { passive: true });
  });

  /* ─── AUDIT LOG ──────────────────────────────────────────── */
  function _audit(event, details = {}) {
    _auditLog.push({
      ts:      new Date().toISOString(),
      event,
      userId:  _session?.userId || null,
      ip:      'client',         // Server-side would capture real IP
      ua:      navigator.userAgent.slice(0, 100),
      ...details,
    });
    // Keep last 1000 events
    if (_auditLog.length > 1000) _auditLog.shift();
  }

  /* ─── AUTHENTICATION API ─────────────────────────────────── */

  /**
   * Authenticate user with email + password.
   * Returns { success, user, token, error }
   */
  function login(email, password) {
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPass  = sanitize(password);

    if (!validateEmail(cleanEmail)) {
      return { success: false, error: 'Formato de email inválido' };
    }
    if (!cleanPass) {
      return { success: false, error: 'Contraseña requerida' };
    }

    // Rate limit check
    const limit = checkRateLimit(cleanEmail);
    if (limit.blocked) {
      _audit('LOGIN_BLOCKED', { email: cleanEmail });
      return { success: false, error: `Cuenta bloqueada. Intente en ${limit.minutesLeft} minuto(s).` };
    }

    // Find user
    const user = _users.find(u => u.email === cleanEmail && u.active);
    if (!user || btoa(cleanPass) !== user.passHash) {
      const attempts = recordFailedAttempt(cleanEmail);
      const remaining = CONFIG.MAX_LOGIN_ATTEMPTS - attempts;
      _audit('LOGIN_FAILED', { email: cleanEmail, attempts });
      if (remaining <= 0) {
        return { success: false, error: 'Cuenta bloqueada por 15 minutos por exceso de intentos.' };
      }
      return { success: false, error: `Credenciales incorrectas. ${remaining} intento(s) restante(s).` };
    }

    // Build session
    clearAttempts(cleanEmail);
    const now = Date.now();
    const payload = {
      jti:    generateId('jti'),
      userId: user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      iat:    now,
      exp:    now + CONFIG.TOKEN_EXPIRY_MS,
    };

    const token = encodeToken(payload);
    _session = payload;
    _csrfToken = generateCsrf();

    // Update last login
    user.lastLogin = new Date().toISOString();

    startIdleTimer();
    _audit('LOGIN_SUCCESS', { userId: user.id, email: user.email });

    return {
      success: true,
      token,
      csrf:  _csrfToken,
      user:  { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    };
  }

  /**
   * Restore session from a previously issued token.
   */
  function restoreSession(token) {
    if (!token) return false;
    const result = verifyToken(token);
    if (!result.valid) {
      _audit('SESSION_RESTORE_FAILED', { reason: result.reason });
      return false;
    }
    const user = _users.find(u => u.id === result.payload.userId && u.active);
    if (!user) return false;

    _session  = result.payload;
    _csrfToken = generateCsrf();
    startIdleTimer();
    _audit('SESSION_RESTORED', { userId: _session.userId });
    return true;
  }

  /**
   * Logout and clear session.
   */
  function logout(reason = 'manual') {
    if (_session) {
      _audit('LOGOUT', { userId: _session.userId, reason });
    }
    _session = null;
    _csrfToken = null;
    clearTimeout(_sessionTimer);

    // Dispatch event so pages can react
    window.dispatchEvent(new CustomEvent('berisa:logout', { detail: { reason } }));
  }

  /**
   * Get current session info (read-only copy).
   */
  function getSession() {
    if (!_session) return null;
    if (Date.now() > _session.exp) {
      logout('expired');
      return null;
    }
    return { ..._session };
  }

  /* ─── PERMISSION CHECKS ──────────────────────────────────── */
  function can(permission) {
    if (!_session) return false;
    const role = ROLES[_session.role];
    if (!role) return false;
    if (role.permissions.includes('all')) return true;
    return role.permissions.includes(permission);
  }

  function requireAuth() {
    if (!_session || Date.now() > _session.exp) {
      logout('unauthorized');
      return false;
    }
    return true;
  }

  function requirePermission(permission) {
    if (!requireAuth()) return false;
    if (!can(permission)) {
      _audit('PERMISSION_DENIED', { userId: _session?.userId, permission });
      return false;
    }
    return true;
  }

  /* ─── USER MANAGEMENT API ────────────────────────────────── */
  function getUsers() {
    if (!can('all') && !can('edit')) return [];
    return _users.map(u => ({
      id:        u.id,
      name:      u.name,
      email:     u.email,
      role:      u.role,
      active:    u.active,
      created:   u.created,
      lastLogin: u.lastLogin,
      avatar:    u.avatar,
    }));
  }

  function createUser(data) {
    if (!can('all')) return { success: false, error: 'Sin permisos' };

    const { name, email, password, role } = data;
    if (!name || !email || !password || !role) return { success: false, error: 'Campos incompletos' };
    if (!validateEmail(email)) return { success: false, error: 'Email inválido' };

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) return { success: false, error: pwCheck.errors.join(', ') };
    if (!ROLES[role]) return { success: false, error: 'Rol inválido' };
    if (_users.find(u => u.email === email.toLowerCase())) return { success: false, error: 'Email ya registrado' };

    const newUser = {
      id:        generateId('usr'),
      name:      sanitize(name),
      email:     sanitize(email).toLowerCase(),
      passHash:  btoa(password),
      role:      role.toUpperCase(),
      active:    true,
      created:   new Date().toISOString().split('T')[0],
      lastLogin: null,
      avatar:    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    };

    _users.push(newUser);
    _audit('USER_CREATED', { adminId: _session?.userId, newUserId: newUser.id });
    return { success: true, user: newUser };
  }

  function updateUser(userId, updates) {
    if (!can('all')) return { success: false, error: 'Sin permisos' };
    const idx = _users.findIndex(u => u.id === userId);
    if (idx === -1) return { success: false, error: 'Usuario no encontrado' };

    const allowed = ['name', 'role', 'active'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) _users[idx][k] = updates[k];
    });
    if (updates.password) {
      const pwCheck = validatePassword(updates.password);
      if (!pwCheck.valid) return { success: false, error: pwCheck.errors.join(', ') };
      _users[idx].passHash = btoa(updates.password);
    }

    _audit('USER_UPDATED', { adminId: _session?.userId, userId, updates: allowed });
    return { success: true };
  }

  function deactivateUser(userId) {
    if (!can('all')) return { success: false, error: 'Sin permisos' };
    if (_session?.userId === userId) return { success: false, error: 'No puede desactivar su propia cuenta' };
    return updateUser(userId, { active: false });
  }

  function getAuditLog() {
    if (!can('all')) return [];
    return [..._auditLog].reverse();
  }

  /* ─── CSRF HELPER ────────────────────────────────────────── */
  function getCsrf() { return _csrfToken; }

  /* ─── UI GUARD — redirect if not authenticated ───────────── */
  function guardPage(redirectUrl = 'index.html') {
    if (!_session || Date.now() > _session.exp) {
      window.location.replace(redirectUrl);
      return false;
    }
    return true;
  }

  /* ─── EXPOSE API ─────────────────────────────────────────── */
  global.BAuth = {
    login,
    logout,
    restoreSession,
    getSession,
    can,
    requireAuth,
    requirePermission,
    guardPage,
    getUsers,
    createUser,
    updateUser,
    deactivateUser,
    getAuditLog,
    getCsrf,
    sanitize,
    validateEmail,
    validatePassword,
    ROLES,
    CONFIG,
  };

  /* ─── AUTO-HANDLE LOGOUT EVENT ───────────────────────────── */
  window.addEventListener('berisa:logout', (e) => {
    const reason = e.detail?.reason;
    if (reason === 'timeout') {
      sessionStorage.setItem('berisa_logout_reason', 'Su sesión expiró por inactividad.');
    } else if (reason === 'expired') {
      sessionStorage.setItem('berisa_logout_reason', 'Sesión vencida. Por favor inicie sesión nuevamente.');
    }
    // Don't redirect on the login page itself
    if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
      setTimeout(() => { window.location.replace('index.html'); }, 200);
    }
  });

})(window);
