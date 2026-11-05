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
  return adminShell('Supplier Price Review', '<p>Record verified SOS product prices for review. Saving here does not change the storefront.</p><form id="supplier-form" class="card"><input type="hidden" name="id"><div class="form-grid">' +
    [['name','Product name','text'],['manufacturer','Manufacturer','text'],['model','Model','text'],['sku','SKU','text'],['category','Category','text'],['supplier_url','SOS product URL','url'],['retail_cents','SOS retail price in cents','number'],['price_verified_on','Date verified','date'],['availability','Availability','text']].map(([name,label,type]) => '<div class="field"><label for="supplier-'+name+'">'+label+'</label><input id="supplier-'+name+'" name="'+name+'" type="'+type+'" '+(['name','supplier_url','retail_cents','price_verified_on'].includes(name)?'required':'')+' '+(name==='retail_cents'?'min="0" step="1"':'')+'></div>').join('') +
    '<div class="field"><label for="supplier-tax">Supplier tax basis</label><select id="supplier-tax" name="tax_basis"><option value="unverified">Unverified</option><option value="before_tax">Before tax</option><option value="includes_tax">Includes tax</option></select></div><div class="field full"><label for="supplier-specs">Specifications</label><textarea id="supplier-specs" name="specifications"></textarea></div></div><div class="actions"><button class="btn" type="submit">Save for Review</button><button class="btn secondary" type="reset">Clear</button></div></form><div id="supplier-message" role="status"></div><section class="section"><h2>Import Records</h2><p>Paste a JSON array using the documented supplier import fields. Imports remain private and pending review.</p><form id="supplier-import"><label for="supplier-import-data">JSON records</label><textarea id="supplier-import-data" name="records" required></textarea><button class="btn" type="submit">Import for Review</button></form></section><h2>Price Observations</h2><div id="supplier-results" class="table-wrap"><p>Loading...</p></div>');
}

async function loadSupplierReviews() {
  const container = document.getElementById('supplier-results');
  if (!container) return;
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
