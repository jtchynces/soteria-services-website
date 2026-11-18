const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
let role = 'editor';
const contentPath = require.resolve('../lib/content');
require.cache[contentPath] = { id: contentPath, filename: contentPath, loaded: true, exports: {
  requesterClient: () => ({}), requesterProfile: async () => ({ profile: { role } }), canAdmin: profile => profile.role === 'administrator'
} };
const { supplierImportHandler } = require('../lib/supplier-import');

(async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['SKU', 'Description', 'MAP', 'Cost']);
  sheet.addRow(['A-1', 'Test item', 20, 12]);
  const file = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
  const body = { action:'preview', file, sheet:'Sheet1', headerRow:1, mapping:{ sku:1, name:2, retail:3, cost:4 } };
  async function call() {
    let status, payload, headers;
    await supplierImportHandler({ method:'POST', headers:{ authorization:'Bearer token' }, body }, { writeHead(code, sentHeaders) { status = code; headers = sentHeaders; }, end(value) { payload = JSON.parse(value); } });
    return { status, payload, headers };
  }
  const editor = await call();
  assert.equal(editor.status, 403);
  assert.equal(editor.payload.rows, undefined);
  role = 'administrator';
  const admin = await call();
  assert.equal(admin.status, 200);
  assert.equal(admin.payload.valid, 1);
  assert.equal(admin.headers['Cache-Control'], 'no-store');
  console.log('Supplier workbook authorization checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
