const assert = require('node:assert/strict');
const supabaseModule = require.resolve('@supabase/supabase-js');
let rows = [], failure;
require.cache[supabaseModule] = { id:supabaseModule, filename:supabaseModule, loaded:true, exports:{ createClient:() => ({
  from(table) { assert.equal(table, 'quote_requests'); return { async insert(row) {
    if (failure) return { error:failure };
    if (row.client_request_id && rows.some(existing => existing.client_request_id === row.client_request_id)) return { error:{ code:'23505', message:'duplicate key value violates unique constraint "quote_requests_client_request_id_unique"' } };
    rows.push(row); return { error:null };
  } }; }
}) } };
process.env.SUPABASE_URL = 'https://development.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-only';
const { saveQuoteRequest } = require('../lib/content');
(async () => {
  const quote = { customer:'Customer', email:'customer@valid.ca', source:'marketing_website' };
  const requestId = '10000000-0000-4000-8000-000000000001';
  assert.equal((await saveQuoteRequest(quote, requestId)).duplicate, false);
  assert.equal((await saveQuoteRequest(quote, requestId)).duplicate, true);
  assert.equal(rows.length, 1);
  failure = { code:'23505', message:'different_unique_constraint' };
  await assert.rejects(saveQuoteRequest(quote, requestId));
  console.log('Quote idempotency storage checks passed.');
})().catch(error => { console.error(error); process.exitCode=1; });
