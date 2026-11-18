const assert = require('node:assert/strict');
const contentPath = require.resolve('../lib/content');
let role = 'editor';
const database = { from() { return { select() { return { order() { return { limit: async () => ({ data: [{ name: 'private' }], error: null }) }; } }; } }; } };
require.cache[contentPath] = { id: contentPath, filename: contentPath, loaded: true, exports: {
  requesterClient: () => database,
  requesterProfile: async () => ({ profile: { role } }),
  canAdmin: profile => profile.role === 'administrator'
} };
const { supplierReviewsHandler } = require('../lib/supplier');
async function request() {
  let status, body;
  await supplierReviewsHandler({ method: 'GET', headers: { authorization: 'Bearer token' } }, {
    writeHead(code) { status = code; }, end(value) { body = JSON.parse(value); }
  });
  return { status, body };
}
(async () => {
  const editor = await request();
  assert.equal(editor.status, 403);
  assert.equal(editor.body.records, undefined);
  role = 'administrator';
  const administrator = await request();
  assert.equal(administrator.status, 200);
  assert.equal(administrator.body.records.length, 1);
  console.log('Supplier role authorization checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
