let supplierReviewRecords = [];

function addEquipmentCategories() {
  const select = document.querySelector('#product-form select[name="category"]');
  if (!select) return;
  for (const category of ['PRESTAN Equipment', 'AED Pads & Batteries', 'AED Cabinets & Accessories', 'First Aid Supplies', 'Medical Supplies', 'Workplace Safety Equipment']) {
    if (![...select.options].some(option => option.value === category)) select.add(new Option(category, category));
  }
}
document.addEventListener('focusin', event => {
  if (event.target.matches('#product-form select[name="category"]')) addEquipmentCategories();
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-edit-product]')) addEquipmentCategories();
}, true);

function supplierAdminPage() {
  if (!session()) return login();
  if (!can('security')) return adminShell('Supplier Price Review', '<p class="notice">Administrator access is required.</p>');
  setTimeout(loadSupplierReviews, 0);
  return adminShell('Supplier Price Review', '<p>Record verified SOS product prices for review. Saving here does not change the storefront.</p><p class="notice">Older saved costs may be estimates. Verify them against current supplier records before using them.</p><form id="supplier-form" class="card"><input type="hidden" name="id"><div class="form-grid">' +
    [['name','Product name','text'],['manufacturer','Manufacturer','text'],['model','Model','text'],['sku','SKU','text'],['category','Category','text'],['supplier_url','SOS product URL','url'],['retail_cents','SOS retail price in cents','number'],['cost_cents','Actual supplier cost in cents','number'],['price_verified_on','Date verified','date'],['availability','Availability','text']].map(([name,label,type]) => '<div class="field"><label for="supplier-'+name+'">'+label+'</label><input id="supplier-'+name+'" name="'+name+'" type="'+type+'" '+(['name','supplier_url','retail_cents','cost_cents','price_verified_on'].includes(name)?'required':'')+' '+(['retail_cents','cost_cents'].includes(name)?'min="0" step="1"':'')+'></div>').join('') +
    '<div class="field"><label for="supplier-tax">Supplier tax basis</label><select id="supplier-tax" name="tax_basis"><option value="unverified">Unverified</option><option value="before_tax">Before tax</option><option value="includes_tax">Includes tax</option></select></div><div class="field full"><label for="supplier-specs">Specifications</label><textarea id="supplier-specs" name="specifications"></textarea></div></div><div class="actions"><button class="btn" type="submit">Save for Review</button><button class="btn secondary" type="reset">Clear</button></div></form><div id="supplier-message" role="status"></div><section class="section"><h2>Import Records</h2><p>Paste a JSON array using the documented supplier import fields. Imports remain private and pending review.</p><form id="supplier-import"><label for="supplier-import-data">JSON records</label><textarea id="supplier-import-data" name="records" required></textarea><button class="btn" type="submit">Import for Review</button></form></section><h2>Price Observations</h2><div id="supplier-results" class="table-wrap"><p>Loading...</p></div>');
}

async function loadSupplierReviews() {
  const container = document.getElementById('supplier-results');
  if (!container) return;
  if (!document.getElementById('workbook-preview-form')) container.insertAdjacentHTML('beforebegin', workbookPreviewMarkup());
  try {
    const active = await requireAdminSession();
    if (!active) return;
    const response = await fetch('/api/admin/supplier-reviews', { headers: { Authorization: 'Bearer ' + active.access_token }, cache: 'no-store' });
    const result = await jsonResponse(response);
    if (!response.ok) throw new Error(result.error || 'Could not load supplier records.');
    supplierReviewRecords = result.records || [];
    container.innerHTML = '<table><thead><tr><th>Product</th><th>SKU</th><th>Retail</th><th>Supplier cost</th><th>Gross profit</th><th>Verified</th><th>Tax</th><th>Status</th><th></th></tr></thead><tbody>' + supplierReviewRecords.map((row, index) => '<tr><td>'+esc(row.name)+'</td><td>'+esc(row.sku)+'</td><td>'+money(row.retail_cents)+'</td><td>'+money(row.cost_cents)+'</td><td>'+money(row.retail_cents-row.cost_cents)+'</td><td>'+esc(row.price_verified_on)+'</td><td>'+esc(row.tax_basis)+'</td><td>'+esc(row.review_status)+'</td><td><button type="button" data-supplier-edit="'+index+'">Edit</button></td></tr>').join('') + '</tbody></table>';
  } catch (error) { container.textContent = error.message; }
}

function workbookPreviewMarkup() {
  const fields = [['sheet','Sheet name','text','Sheet1'],['headerRow','Header row','number','5'],['sku','Item number column','number','1'],['name','Description column','number','2'],['retail','MSRP / MAP column','number','3'],['cost','Distributor cost column','number','6'],['dimensions','Dimensions column (optional)','number','4'],['weight','Weight column (optional)','number','5']];
  return '<section class="section"><h2>Excel Workbook Preview</h2><form id="workbook-preview-form"><div class="form-grid"><div class="field full"><label for="workbook-file">Supplier XLSX file</label><input id="workbook-file" name="file" type="file" accept=".xlsx" required></div><div class="field full"><label for="workbook-preset">Column mapping</label><select id="workbook-preset" name="preset"><option value="prestan">PRESTAN 2025</option><option value="aed">AED June 2026</option><option value="custom">Custom</option></select></div>' + fields.map(([name,label,type,value])=>'<div class="field"><label for="workbook-'+name+'">'+label+'</label><input id="workbook-'+name+'" name="'+name+'" type="'+type+'" value="'+value+'" '+(['sheet','headerRow','sku','name','retail','cost'].includes(name)?'required':'')+' '+(type==='number'?'min="1" max="50"':'')+'></div>').join('') + '</div><div class="actions"><button class="btn" type="submit">Preview Workbook</button></div></form><div id="workbook-preview-message" role="status"></div><div id="workbook-preview-results" class="table-wrap"></div></section>';
}

document.addEventListener('change', event => {
  if (event.target.id !== 'workbook-preset') return;
  const form = event.target.form;
  const mapping = event.target.value === 'prestan' ? { headerRow:5, sku:1, name:2, retail:3, cost:6, dimensions:4, weight:5 } : event.target.value === 'aed' ? { headerRow:2, sku:4, name:3, retail:5, cost:6, dimensions:'', weight:'' } : null;
  if (mapping) for (const [key, value] of Object.entries(mapping)) form.elements[key].value = value;
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'workbook-preview-form') return;
  event.preventDefault();
  const form = event.target, button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const file = form.elements.file.files[0];
    if (!file || !/\.xlsx$/i.test(file.name) || file.size > 1024 * 1024) throw new Error('Choose an XLSX file under 1 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 16384) binary += String.fromCharCode(...bytes.subarray(index, index + 16384));
    const mapping = {};
    for (const key of ['sku','name','retail','cost','dimensions','weight']) if (form.elements[key].value) mapping[key] = Number(form.elements[key].value);
    const active = await requireAdminSession();
    if (!active) throw new Error('Please sign in again.');
    const response = await fetch('/api/admin/supplier-import', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+active.access_token }, body:JSON.stringify({ action:'preview', file:btoa(binary), sheet:form.elements.sheet.value, headerRow:Number(form.elements.headerRow.value), mapping }) });
    const result = await jsonResponse(response);
    if (!response.ok) throw new Error(result.error || 'Workbook preview failed.');
    setMessage('workbook-preview-message', '<p class="notice">'+result.valid+' valid rows, '+result.invalid+' needing review. Preview only; no products or prices were saved.</p>');
    document.getElementById('workbook-preview-results').innerHTML = '<table><thead><tr><th>Row</th><th>Item number</th><th>Description</th><th>MSRP / MAP</th><th>Supplier cost</th><th>Review</th></tr></thead><tbody>' + result.rows.map(row=>'<tr><td>'+row.row+'</td><td>'+esc(row.sku)+'</td><td>'+esc(row.name)+'</td><td>'+(row.retail_cents == null ? 'Not provided' : money(row.retail_cents))+(row.warnings.some(w=>w.startsWith('Retail'))?' (source: '+esc(row.retail_source)+')':'')+'</td><td>'+(row.cost_cents == null ? 'Not provided' : money(row.cost_cents))+(row.warnings.some(w=>w.startsWith('Supplier'))?' (source: '+esc(row.cost_source)+')':'')+'</td><td>'+esc([...row.errors,...row.warnings].join('; ') || 'Ready for review')+'</td></tr>').join('') + '</tbody></table>';
  } catch (error) { setMessage('workbook-preview-message', '<p class="notice" role="alert">'+esc(error.message)+'</p>'); }
  finally { button.disabled = false; }
});

async function saveSupplierReviews(records) {
  const active = await requireAdminSession();
  if (!active) throw new Error('Please sign in again.');
  const response = await fetch('/api/admin/supplier-reviews', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:'Bearer '+active.access_token }, body: JSON.stringify({ records }) });
  const result = await jsonResponse(response);
  if (!response.ok) throw new Error(result.error || 'Supplier records could not be saved.');
  return result;
}

document.addEventListener('submit', async event => {
  if (!['supplier-form', 'supplier-import'].includes(event.target.id)) return;
  event.preventDefault();
  const form = event.target, button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const records = form.id === 'supplier-form' ? [Object.fromEntries(new FormData(form))] : JSON.parse(form.elements.records.value);
    if (!Array.isArray(records)) throw new Error('Import must be a JSON array.');
    await saveSupplierReviews(records);
    form.reset();
    setMessage('supplier-message', '<p class="notice">Saved for review. No public prices were changed.</p>');
    await loadSupplierReviews();
  } catch (error) { setMessage('supplier-message', '<p class="notice" role="alert">'+esc(error.message)+'</p>'); }
  finally { button.disabled = false; }
});

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-supplier-edit]');
  if (!edit) return;
  const row = supplierReviewRecords[Number(edit.dataset.supplierEdit)], form = document.getElementById('supplier-form');
  if (!row || !form) return;
  for (const [key, value] of Object.entries(row)) if (form.elements[key]) form.elements[key].value = value == null ? '' : value;
  form.scrollIntoView({ behavior: 'smooth' });
});
