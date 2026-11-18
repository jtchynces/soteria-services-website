const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const ExcelJS = require('exceljs');
const { loadWorkbook, previewSheet, supplierImportHandler, toCents } = require('../lib/supplier-import');

(async () => {
  assert.equal(toCents('1,234.50'), 123450);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(''), null);
  assert.equal(toCents('1,5'), null);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['SKU', 'Description', 'MAP', 'Cost']);
  sheet.addRow(['A-1', 'First', 20, 12]);
  sheet.addRow(['a-1', 'Duplicate', 10, 7]);
  sheet.addRow(['B-2', 'Missing cost', 10, null]);
  sheet.addRow(['C-3', 'Fractional cents', 10.005, 7.005]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const loaded = await loadWorkbook(buffer);
  const preview = previewSheet(loaded.getWorksheet('Sheet1'), 1, { sku:1, name:2, retail:3, cost:4 });
  assert.equal(preview[0].retail_cents, 2000);
  assert.equal(preview[0].cost_cents, 1200);
  assert.match(preview[0].errors.join(' '), /Duplicate/);
  assert.match(preview[1].errors.join(' '), /Duplicate/);
  assert.match(preview[2].errors.join(' '), /supplier cost/);
  assert.equal(preview[3].retail_source, 10.005);
  assert.match(preview[3].warnings.join(' '), /rounding/);
  assert.throws(() => previewSheet(sheet, 1, { sku:1, name:1, retail:3, cost:4 }));
  await assert.rejects(() => loadWorkbook(Buffer.from('not xlsx')));
  let status;
  const req = Readable.from([]); req.method = 'POST'; req.headers = {};
  await supplierImportHandler(req, { writeHead(code) { status = code; }, end() {} });
  assert.equal(status, 401);
  for (const [env, header, mapping, expected] of [
    ['SOTERIA_TEST_PRESTAN_XLSX', 5, { sku:1, name:2, retail:3, cost:6, dimensions:4, weight:5 }, 242],
    ['SOTERIA_TEST_AED_XLSX', 2, { sku:4, name:3, retail:5, cost:6 }, 41]
  ]) {
    if (!process.env[env]) continue;
    const actual = await loadWorkbook(fs.readFileSync(process.env[env]));
    const rows = previewSheet(actual.worksheets[0], header, mapping);
    assert.equal(rows.filter(row => !row.errors.length).length, expected, env);
  }
  console.log('Supplier workbook preview checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
