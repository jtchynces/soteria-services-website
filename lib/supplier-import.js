const { requesterClient, requesterProfile, canAdmin } = require('./content');

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 1500;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function inspectArchive(buffer) {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(new Error('The file is not a valid Excel workbook.'));
      let total = 0, count = 0, finished = false;
      const fail = message => { if (!finished) { finished = true; zip.close(); reject(new Error(message)); } };
      zip.on('error', () => fail('The workbook archive could not be read.'));
      zip.on('entry', entry => {
        count++; total += entry.uncompressedSize;
        if (count > 300 || total > MAX_EXPANDED_BYTES || entry.uncompressedSize > MAX_EXPANDED_BYTES || (entry.generalPurposeBitFlag & 1) || /(^|\/)\.\.(\/|$)|vbaProject\.bin$/i.test(entry.fileName)) return fail('The workbook exceeds import limits or contains unsupported content.');
        zip.readEntry();
      });
      zip.on('end', () => { if (!finished) { finished = true; resolve(); } });
      zip.readEntry();
    });
  });
}

async function loadWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('Choose an XLSX file under 1 MB.');
  await inspectArchive(buffer);
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw new Error('The Excel workbook could not be read.'); }
  if (!workbook.worksheets.length || workbook.worksheets.length > 20) throw new Error('The workbook has an unsupported number of sheets.');
  return workbook;
}

function cellValue(cell) {
  const value = cell.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result == null ? '' : value.result;
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
    return value.text || '';
  }
  return value;
}

function toCents(value) {
  if (value === '' || value == null || typeof value === 'boolean') return null;
  const text = String(value).trim();
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;
  const amount = Number(text.replace(/[$,]/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) return null;
  return Math.round(amount * 100);
}

function hasFractionalCents(value) {
  const number = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(number) && Math.abs(number * 100 - Math.round(number * 100)) > 0.0000001;
}

function previewSheet(sheet, headerRow, mapping) {
  if (!sheet || !Number.isInteger(headerRow) || headerRow < 1 || headerRow > sheet.rowCount || sheet.rowCount > MAX_ROWS) throw new Error('Select a valid worksheet and header row.');
  for (const name of ['sku', 'name', 'retail', 'cost']) {
    if (!Number.isInteger(mapping[name]) || mapping[name] < 1 || mapping[name] > 50) throw new Error('Map SKU, description, retail and supplier cost columns.');
  }
  const columns = Object.values(mapping).filter(value => value != null && value !== '');
  if (columns.some(value => !Number.isInteger(value) || value < 1 || value > 50) || new Set(columns).size !== columns.length) throw new Error('Each mapped field needs a distinct column number between 1 and 50.');
  const rows = [];
  for (let number = headerRow + 1; number <= sheet.rowCount; number++) {
    const row = sheet.getRow(number);
    const get = name => mapping[name] ? cellValue(row.getCell(mapping[name])) : '';
    const sku = String(get('sku')).trim(), name = String(get('name')).trim();
    const retailSource = get('retail'), costSource = get('cost');
    const retail = toCents(retailSource), cost = toCents(costSource);
    if (!sku && !name && retail === null && cost === null) continue;
    const errors = [];
    if (!sku) errors.push('Missing item number');
    if (!name) errors.push('Missing description');
    if (retail === null) errors.push('Missing or invalid retail/MAP');
    if (cost === null) errors.push('Missing or invalid supplier cost');
    const warnings = [];
    if (retail !== null && hasFractionalCents(retailSource)) warnings.push('Retail/MAP contains fractional cents; verify rounding');
    if (cost !== null && hasFractionalCents(costSource)) warnings.push('Supplier cost contains fractional cents; verify rounding');
    rows.push({ row: number, sku, name, retail_cents: retail, cost_cents: cost, retail_source: retailSource, cost_source: costSource, dimensions: String(get('dimensions') || ''), weight: get('weight'), errors, warnings });
  }
  const counts = new Map();
  for (const row of rows) if (row.sku) counts.set(row.sku.toLowerCase(), (counts.get(row.sku.toLowerCase()) || 0) + 1);
  for (const row of rows) if (row.sku && counts.get(row.sku.toLowerCase()) > 1) row.errors.push('Duplicate item number');
  return rows;
}

async function supplierImportHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!String(req.headers.authorization || '').startsWith('Bearer ')) return json(res, 401, { error: 'Missing access token' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Administrator authentication is unavailable.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canAdmin(auth.profile)) return json(res, 403, { error: 'Administrator access required.' });
  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 1500000) throw new Error('Workbook is too large.'); }
      body = JSON.parse(raw);
    }
    if (!body || typeof body.file !== 'string' || body.file.length > 1400000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.file)) throw new Error('Choose a valid XLSX file under 1 MB.');
    const workbook = await loadWorkbook(Buffer.from(body.file, 'base64'));
    if (body.action === 'inspect') {
      return json(res, 200, { sheets: workbook.worksheets.map(sheet => ({ name: sheet.name, rows: sheet.rowCount, columns: sheet.columnCount })) });
    }
    if (body.action !== 'preview') throw new Error('Unsupported import action.');
    const sheet = workbook.getWorksheet(String(body.sheet || ''));
    const rows = previewSheet(sheet, Number(body.headerRow), body.mapping || {});
    return json(res, 200, { sheet: sheet.name, rows, valid: rows.filter(row => !row.errors.length).length, invalid: rows.filter(row => row.errors.length).length });
  } catch (error) {
    return json(res, 400, { error: error.message || 'The workbook could not be previewed.' });
  }
}

module.exports = { supplierImportHandler, loadWorkbook, previewSheet, toCents };
