const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const root = path.join(__dirname, '..');

function mockRes() {
  return {
    statusCode: 0,
    body: '',
    json: null,
    writeHead(status) { this.statusCode = status; },
    end(payload) {
      this.body = payload || '';
      this.json = this.body ? JSON.parse(this.body) : null;
    }
  };
}

function mockReq(body, { method = 'POST', authorization = 'Bearer token' } = {}) {
  const listeners = {};
  const req = {
    method,
    headers: { authorization },
    on(event, cb) {
      listeners[event] = cb;
      return req;
    }
  };
  queueMicrotask(() => {
    if (listeners.data) listeners.data(JSON.stringify(body));
    if (listeners.end) listeners.end();
  });
  return req;
}

const calls = [];
let inviteResult = { data: { user: { id: 'new-user' } }, error: null };
let upsertResult = { error: null };
let requesterRole = 'administrator';

const fakeAdmin = {
  auth: {
    async getUser() {
      return { data: { user: { id: 'admin-id' } }, error: null };
    },
    admin: {
      async inviteUserByEmail(email, options) {
        calls.push({ type: 'invite', email, options });
        return inviteResult;
      }
    }
  },
  from() {
    return {
      select() { return this; },
      eq() { return this; },
      async single() {
        return { data: { role: requesterRole }, error: null };
      },
      async upsert(row) {
        calls.push({ type: 'upsert', row });
        return upsertResult;
      }
    };
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return { createClient: () => fakeAdmin };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.SITE_URL = 'https://soteriaservices.net';

const { inviteUserHandler } = require('../lib/auth');

function resetInvite() {
  calls.length = 0;
  inviteResult = { data: { user: { id: 'new-user' } }, error: null };
  upsertResult = { error: null };
  requesterRole = 'administrator';
}

async function invite(body, options) {
  const res = mockRes();
  await inviteUserHandler(mockReq(body, options), res);
  return res;
}

async function testInviteMetadataAndUpsert() {
  resetInvite();
  const res = await invite({
    email: ' New.Person@Example.com ',
    fullName: ' New Person ',
    role: 'administrator'
  });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.json, { ok: true, email: 'new.person@example.com', role: 'administrator' });
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[0], {
    type: 'invite',
    email: 'new.person@example.com',
    options: {
      redirectTo: 'https://soteriaservices.net/admin',
      data: { full_name: 'New Person' }
    }
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[0].options.data, 'role'), false);
  assert.deepStrictEqual(calls[1], {
    type: 'upsert',
    row: {
      id: 'new-user',
      user_id: 'new-user',
      email: 'new.person@example.com',
      full_name: 'New Person',
      role: 'administrator'
    }
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[1].row, 'status'), false);
}

async function testNonAdministratorRoleStaysEditorWithoutMetadata() {
  resetInvite();
  const res = await invite({ email: 'ed@example.com', fullName: 'Ed', role: 'Pending User' });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.json.role, 'editor');
  assert.deepStrictEqual(calls[0].options.data, { full_name: 'Ed' });
  assert.strictEqual(calls[1].row.role, 'editor');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[1].row, 'status'), false);
}

async function testProfileWriteErrorIsReturned() {
  resetInvite();
  upsertResult = { error: { message: 'profiles write failed' } };
  const res = await invite({ email: 'ed@example.com', fullName: 'Ed', role: 'editor' });
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.json, { error: 'profiles write failed' });
  assert.strictEqual(calls.filter((call) => call.type === 'upsert').length, 1);
}

async function testInviteErrorDoesNotUpsert() {
  resetInvite();
  inviteResult = { data: null, error: { message: 'invite rejected' } };
  const res = await invite({ email: 'ed@example.com', fullName: 'Ed', role: 'editor' });
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.json, { error: 'invite rejected' });
  assert.deepStrictEqual(calls.map((call) => call.type), ['invite']);
}

async function testNonAdminCannotInvite() {
  resetInvite();
  requesterRole = 'editor';
  const res = await invite({ email: 'ed@example.com', fullName: 'Ed', role: 'administrator' });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(calls.length, 0);
}

function executableSql(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function testMigrationsDoNotRestorePrivilegedSignup() {
  const files = [
    'supabase/migrations/001_auth_profiles_roles.sql',
    'supabase/marketing-fix/02_corrected_marketing_migration.sql'
  ];
  for (const file of files) {
    const sql = executableSql(file);
    assert.ok(!/create\s+(or\s+replace\s+)?function\s+public\.handle_new_user/i.test(sql), file + ' recreates handle_new_user');
    assert.ok(!/create\s+trigger\s+on_auth_user_created/i.test(sql), file + ' recreates on_auth_user_created');
    assert.ok(!/drop\s+trigger\s+if\s+exists\s+on_auth_user_created/i.test(sql), file + ' drops the shared trigger');
    assert.ok(!/raw_user_meta_data\s*->>\s*'role'/i.test(sql), file + ' reads metadata role');
    assert.ok(!/excluded\.role/i.test(sql), file + ' writes excluded.role');
    assert.ok(!/set\s+role\s*=\s*'editor'/i.test(sql), file + ' sets role to editor');
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(source.includes("'Pending User'"), file + ' does not name Pending User');
    assert.ok(source.includes("'Pending'"), file + ' does not name Pending status');
    assert.ok(/drop\s+policy\s+if\s+exists\s+"Users can update own basic profile"/i.test(sql), file + ' does not drop the self-update policy');
    assert.ok(!/create\s+policy\s+"Users can update own basic profile"/i.test(sql), file + ' recreates the self-update policy');
  }
}

function element() {
  return {
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    innerHTML: '',
    textContent: '',
    src: '',
    setAttribute() {},
    addEventListener() {}
  };
}

async function testAdminShellGatesPendingUsers() {
  const context = {
    console,
    URL,
    URLSearchParams,
    Map,
    Intl,
    fetch: async (url) => {
      const target = String(url);
      if (target.includes('site-settings')) return { ok: true, json: async () => ({ settings: {} }) };
      if (target.includes('content')) return { ok: true, json: async () => ({ content: [] }) };
      if (target.includes('products')) return { ok: true, json: async () => ({ products: [] }) };
      return { ok: false, json: async () => ({}) };
    },
    setTimeout,
    clearTimeout,
    location: { pathname: '/admin', origin: 'http://localhost:3000', search: '', href: 'http://localhost:3000/admin' },
    history: { pushState() {}, replaceState() {} },
    window: { scrollTo() {}, addEventListener() {} },
    localStorage: { getItem() { return '[]'; }, setItem() {} },
    document: {
      title: '',
      body: element(),
      addEventListener() {},
      getElementById() { return element(); },
      querySelector() { return element(); },
      querySelectorAll() { return []; }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
    + '\nglobalThis.__setAuth = (profile, session) => { currentProfile = profile; currentSession = session; };';
  vm.runInContext(source, context, { filename: 'app.js' });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  context.__setAuth(
    { role: 'Pending User', full_name: 'Pat', email: 'pat@example.com' },
    { user: { email: 'pat@example.com' }, access_token: 'token' }
  );
  for (const render of ['admin', 'adminShell', 'adminProducts', 'adminContent', 'adminOrders', 'adminSettings', 'adminInvite']) {
    const html = render === 'adminShell'
      ? context.adminShell('Settings', '<form id="settings-form"></form>')
      : context[render]();
    assert.ok(String(html).includes('Account pending'), render + ' showed the admin shell to a pending user');
    assert.ok(!String(html).includes('admin-tabs'), render + ' showed admin navigation to a pending user');
  }
  assert.strictEqual(context.can('users'), false);
  assert.strictEqual(context.isStaff({ role: 'Pending User' }), false);

  context.__setAuth(
    { role: 'editor', full_name: 'Ed', email: 'ed@example.com' },
    { user: { email: 'ed@example.com' }, access_token: 'token' }
  );
  assert.strictEqual(context.isStaff({ role: 'editor' }), true);
  assert.strictEqual(context.can('users'), false);
  const editorShell = context.adminShell('Products', '<p>editor body</p>');
  assert.ok(editorShell.includes('admin-tabs'));
  assert.ok(editorShell.includes('editor body'));
  assert.ok(context.adminInvite().includes('Editors cannot invite users'));

  context.__setAuth(
    { role: 'administrator', full_name: 'Ada', email: 'ada@example.com' },
    { user: { email: 'ada@example.com' }, access_token: 'token' }
  );
  assert.strictEqual(context.can('users'), true);
  assert.ok(context.adminProducts().includes('admin-tabs'));
  assert.ok(context.adminInvite().includes('invite-form'));
  assert.ok(!context.admin().includes('Account pending'));
}

async function main() {
  await testInviteMetadataAndUpsert();
  await testNonAdministratorRoleStaysEditorWithoutMetadata();
  await testProfileWriteErrorIsReturned();
  await testInviteErrorDoesNotUpsert();
  await testNonAdminCannotInvite();
  testMigrationsDoNotRestorePrivilegedSignup();
  await testAdminShellGatesPendingUsers();
  console.log('Auth invite and pending-access tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
