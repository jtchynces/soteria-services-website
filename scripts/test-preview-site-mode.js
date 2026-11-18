const assert = require('node:assert/strict');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SOS_CATALOG_PREVIEW;
delete process.env.ENABLE_DEMO_CONTENT;
delete process.env.PREVIEW_SITE_MODE;
delete process.env.VERCEL_ENV;

const rows = [{ key: 'public_site_mode', value: 'coming_soon' }];
let writes = 0;
const db = {
  from(table) {
    return {
      select() {
        if (table !== 'site_settings') throw new Error('Unexpected table ' + table);
        return Promise.resolve({ data: rows.map((row) => ({ ...row })), error: null });
      },
      upsert() { writes += 1; return Promise.resolve({ error: null }); },
      update() { writes += 1; return Promise.resolve({ error: null }); }
    };
  }
};
const supabasePath = require.resolve('@supabase/supabase-js');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { createClient: () => db } };
const { publicSettingsHandler } = require('../lib/content');

async function mode() {
  let status, body;
  await publicSettingsHandler({ method: 'GET', headers: {} }, {
    writeHead(code) { status = code; },
    end(value) { body = JSON.parse(value); }
  });
  assert.equal(status, 200);
  return body.settings.public_site_mode;
}

(async () => {
  process.env.SUPABASE_URL = 'https://valid.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test';

  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_SITE_MODE = 'live';
  assert.equal(await mode(), 'live');

  delete process.env.PREVIEW_SITE_MODE;
  assert.equal(await mode(), 'coming_soon');

  process.env.VERCEL_ENV = 'production';
  process.env.PREVIEW_SITE_MODE = 'live';
  assert.equal(await mode(), 'coming_soon');

  assert.equal(rows[0].value, 'coming_soon');
  assert.equal(writes, 0);
  console.log('Preview site mode checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
