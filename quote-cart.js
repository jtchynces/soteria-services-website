const QuoteCart = (() => {
  const key = 'soteria-quote-cart-v1';
  const services = ['Installation inquiry', 'Training inquiry', 'Soteria Pulse management inquiry'];
  let busy = false, notice = '', legacyError = '';

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return { items:Array.isArray(value.items) ? value.items : [], services:Array.isArray(value.services) ? value.services : [], requestId:typeof value.requestId === 'string' ? value.requestId : '' };
    } catch { return { items:[], services:[], requestId:'' }; }
  }
  function write(cart) { localStorage.setItem(key, JSON.stringify(cart)); updateCount(); }
  function migrateLegacy() {
    try {
      if (localStorage.getItem('soteria-unified-cart-migrated-v1')) return;
      const raw = localStorage.getItem('soteria-cart');
      if (!raw) { localStorage.setItem('soteria-unified-cart-migrated-v1', '1'); return; }
      const legacy = JSON.parse(raw), cart = read();
      if (!Array.isArray(legacy) || (cart.requestId && legacy.length)) throw new Error('The previous cart needs review before it can be combined.');
      for (const item of legacy) {
        const id = item.productId || item.id, quantity = Number(item.quantity);
        if (typeof id !== 'string' || !id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('The previous cart contains an invalid item.');
        const existing = cart.items.find(entry => entry.productId === id);
        if (existing && existing.quantity + quantity > 99) throw new Error('The combined cart exceeds the per-item quantity limit.');
        if (existing) existing.quantity += quantity; else cart.items.push({ productId:id, quantity });
      }
      if (cart.items.length > 30) throw new Error('The combined cart exceeds the item limit.');
      if (legacy.length) { cart.requestId = ''; localStorage.setItem(key, JSON.stringify(cart)); }
      localStorage.setItem('soteria-unified-cart-migrated-v1', '1');
    } catch (error) { legacyError = error.message || 'The previous cart could not be combined.'; }
  }
  function updateCount() {
    const badge = document.getElementById('quote-cart-count');
    if (badge) badge.textContent = String(read().items.reduce((sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0), 0));
  }
  function add(items, selectedServices = []) {
    if (busy) throw new Error('Wait for the current quote request to finish.');
    const cart = read();
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Quantity must be between 1 and 99.');
      const existing = cart.items.find(entry => entry.productId === item.productId);
      if (existing && existing.quantity + item.quantity > 99) throw new Error('Maximum quantity is 99 per product.');
      if (existing) existing.quantity += item.quantity;
      else cart.items.push({ productId:item.productId, quantity:item.quantity });
    }
    if (cart.items.length > 30) throw new Error('A quote can contain up to 30 products.');
    cart.services = [...new Set([...cart.services, ...selectedServices.filter(service => services.includes(service))])];
    cart.requestId = '';
    notice = '';
    write(cart);
  }
  function addPackage(items) {
    add(items.filter(item => item.productId).map(item => ({ productId:item.productId, quantity:item.quantity })), items.filter(item => item.type === 'service').map(item => item.name));
  }
  function refreshPreservingContact() {
    const form = document.getElementById('quote-cart-form');
    const values = form ? Object.fromEntries(new FormData(form)) : null;
    render();
    const updated = document.getElementById('quote-cart-form');
    if (values && updated) for (const [name, value] of Object.entries(values)) if (updated.elements[name]) updated.elements[name].value = value;
  }
  function renderPage() {
    const cart = read(), catalog = products();
    const eligible = product => !!product && product.enabled !== false && product.checkout_verified === true && product.price_verified === true && product.fulfillment_verified === true && product.shipping_verified === true && ['buy_now','deposit_only'].includes(product.mode) && product.currency === 'cad' && (product.tax_behavior === 'non_taxable' || product.checkout_before_tax_confirmation === true) && Number.isSafeInteger(product.amount) && product.amount >= 50 && !['out_of_stock','unavailable','sold_out'].includes(String(product.inventory_status || '').toLowerCase());
    const resolved = cart.items.map(item => ({ item, product:catalog.find(entry => entry.id === item.productId) }));
    const aeds = resolved.filter(row => row.product && AedCatalog.build([row.product]).aeds.length).map(row => row.product);
    const accessories = resolved.filter(row => row.product && AedCatalog.build([row.product]).accessories.length).map(row => row.product);
    const compatible = !aeds.length || accessories.every(part => aeds.some(aed => AedCatalog.compatible(aed, part)));
    const canCheckout = !legacyError && !cart.services.length && compatible && resolved.length > 0 && resolved.length <= 30 && new Set(cart.items.map(item=>item.productId)).size === cart.items.length && resolved.every(row => eligible(row.product) && Number.isInteger(row.item.quantity) && row.item.quantity >= 1 && row.item.quantity <= 99);
    const hasAed = resolved.some(row => row.product && (row.product.installation_group === 'aed' || AedCatalog.build([row.product]).aeds.length));
    const installBlock = hasAed ? '<div class="card" id="install-offer"><h2>Free installation</h2><p>Optional for an AED shipping within Southwestern Ontario. AED pad serial numbers are recorded on site at installation. Shipping is a placeholder flat rate of $19.99 CAD per order, added at checkout. Tax is not calculated yet.</p><div class="form-grid"><div class="field"><label for="install-line1">Shipping address</label><input id="install-line1" autocomplete="address-line1"></div><div class="field"><label for="install-city">City</label><input id="install-city"></div><div class="field"><label for="install-province">Province</label><input id="install-province" value="ON"></div><div class="field"><label for="install-postal">Postal code</label><input id="install-postal" placeholder="N6A 1A1"></div></div><div id="install-choice" hidden><label><input type="checkbox" id="install-requested"> <strong>Free installation</strong></label><p id="install-copy"></p></div></div>' : '';
    const rows = cart.items.map((item, index) => {
      const product = catalog.find(entry => entry.id === item.productId);
      const sku = product && AedCatalog.partNumber(product);
      return '<tr><td>'+esc(product?.name || 'Product no longer available')+(sku?'<br><small>Manufacturer part: '+esc(sku)+'</small>':'')+'</td><td><label>Quantity <input type="number" min="1" max="99" value="'+esc(item.quantity)+'" data-quote-quantity="'+index+'"></label></td><td><button class="btn secondary" type="button" data-quote-remove="'+index+'">Remove</button></td></tr>';
    }).join('');
    const selectedServices = cart.services.length ? '<fieldset><legend>Selected services</legend>'+cart.services.map(service=>'<label><input type="checkbox" data-quote-service value="'+esc(service)+'" checked> '+esc(service)+'</label>').join(' ')+'</fieldset>' : '';
    return hero('Cart','Review your selections and request a quote.','Contact Us')+'<section class="section"><div id="quote-cart-notice" role="status">'+(notice?'<p class="notice">'+esc(notice)+'</p>':'')+(legacyError?'<p class="notice" role="alert">'+esc(legacyError)+' Your previous cart has been preserved on this device.</p>':'')+'</div>'+(cart.items.length?'<div class="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+selectedServices+(canCheckout?'<p>Verified subtotal: <strong>'+money(resolved.reduce((sum,row)=>sum+row.product.amount*row.item.quantity,0))+'</strong></p><button class="btn" type="button" data-unified-checkout>Checkout</button><div id="unified-checkout-message" role="status"></div>':'<p>Pricing, availability and delivery will be confirmed in your quote.</p>')+installBlock+'<form id="quote-cart-form" class="card"><h2>Request a Quote</h2><div class="form-grid"><div class="field"><label for="qc-name">Name</label><input id="qc-name" name="name" required maxlength="150"></div><div class="field"><label for="qc-org">Organization</label><input id="qc-org" name="organization" maxlength="150"></div><div class="field"><label for="qc-email">Email</label><input id="qc-email" name="email" type="email" required maxlength="254"></div><div class="field"><label for="qc-phone">Phone</label><input id="qc-phone" name="phone" type="tel" maxlength="50"></div><div class="field full"><label for="qc-location">Delivery location</label><input id="qc-location" name="deliveryLocation" maxlength="200"></div><div class="field full"><label for="qc-message">Additional instructions</label><textarea id="qc-message" name="message" maxlength="2000"></textarea></div></div><button class="btn" type="submit">Submit Quote Request</button><div id="quote-cart-message" role="status"></div></form>':'<p>Your cart is empty.</p>')+'<div class="actions"><a class="btn secondary" href="/shop-equipment" data-link>Continue Shopping</a></div></section>';
  }
  async function refreshInstallation() {
    const choice = document.getElementById('install-choice');
    if (!choice) return;
    const province = (document.getElementById('install-province') || {}).value || '';
    const postal = (document.getElementById('install-postal') || {}).value || '';
    const productIds = read().items.map(item => item.productId);
    if (!province || !postal || !productIds.length) { choice.hidden = true; return; }
    try {
      const response = await fetch('/api/installation-preview', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ province, postal, productIds }) });
      const result = await jsonResponse(response);
      const offer = result && result.installation;
      if (!response.ok || !offer || !offer.available) { choice.hidden = true; const box = document.getElementById('install-requested'); if (box) box.checked = false; return; }
      choice.hidden = false;
      const copy = document.getElementById('install-copy');
      if (copy) copy.textContent = offer.description || '';
    } catch (error) { choice.hidden = true; }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-quote-add]');
    if (button) {
      const product = products().find(item => item.id === button.dataset.quoteAdd);
      const input = button.closest('article, .card')?.querySelector('[data-quote-card-quantity]');
      try {
        if (!product) throw new Error('This product is no longer available.');
        add([{ productId:product.id, quantity:Number(input?.value || 1) }]);
        button.textContent = 'Added to Cart';
      } catch (error) { button.textContent = error.message; }
    }
    const remove = event.target.closest('[data-quote-remove]');
    if (remove && !busy) { const cart = read(); cart.items.splice(Number(remove.dataset.quoteRemove), 1); if (!cart.items.length) cart.services = []; cart.requestId = ''; write(cart); refreshPreservingContact(); }
    const packageButton = event.target.closest('[data-quote-add-package]');
    if (packageButton) {
      try { const items = configuratorItems(); if (!items.some(item => item.type === 'aed')) throw new Error('Choose an AED first.'); addPackage(items); go('/cart'); }
      catch (error) { setMessage('aed-configurator-message','<div class="notice" role="alert">'+esc(error.message)+'</div>'); }
    }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-unified-checkout]');
    if (!button || busy) return;
    busy = true; button.disabled = true;
    try {
      const cart = read();
      if (legacyError || cart.services.length) throw new Error('Please request a quote for this cart.');
      const province = document.getElementById('install-province'), postal = document.getElementById('install-postal'), requested = document.getElementById('install-requested');
      const response = await fetch('/api/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ items:cart.items, installationRequested: !!(requested && requested.checked), shippingAddress: { country:'CA', line1:(document.getElementById('install-line1')||{}).value||'', city:(document.getElementById('install-city')||{}).value||'', province: province ? province.value : '', postal: postal ? postal.value : '' } }) });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result.error || 'Checkout is not available.');
      location.href = result.url;
    } catch (error) { setMessage('unified-checkout-message','<p class="notice" role="alert">'+esc(error.message)+'</p>'); }
    finally { busy = false; button.disabled = false; }
  });
  document.addEventListener('change', event => {
    if (busy) return;
    if (event.target.matches('[data-quote-service]')) {
      const cart = read(), service = event.target.value;
      if (!event.target.checked) cart.services = cart.services.filter(item => item !== service);
      else if (services.includes(service) && !cart.services.includes(service)) cart.services.push(service);
      cart.requestId = ''; write(cart); return;
    }
    if (event.target.matches('#install-province, #install-postal, #install-line1, #install-city')) { refreshInstallation(); return; }
    if (!event.target.matches('[data-quote-quantity]')) return;
    const cart = read(), index = Number(event.target.dataset.quoteQuantity), quantity = Number(event.target.value);
    if (cart.items[index] && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) { cart.items[index].quantity = quantity; cart.requestId = ''; write(cart); }
    else if (cart.items[index]) event.target.value = cart.items[index].quantity;
  });
  document.addEventListener('submit', async event => {
    if (event.target.id !== 'quote-cart-form') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    const button = event.target.querySelector('button[type=submit]');
    button.disabled = true; button.textContent = 'Submitting...';
    try {
      const cart = read();
      if (legacyError) throw new Error('Please resolve the previous cart before submitting.');
      if (!cart.items.length) throw new Error('Your cart is empty.');
      if (!cart.requestId) { cart.requestId = crypto.randomUUID(); write(cart); }
      const data = Object.fromEntries(new FormData(event.target));
      const response = await fetch('/api/quote-request', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ ...data, serviceInterest:'Equipment', requestId:cart.requestId, quoteCart:{ items:cart.items, services:cart.services } }) });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result.error || 'Your quote request could not be submitted.');
      write({ items:[], services:[], requestId:'' });
      notice = 'Quote request received. Soteria Services will follow up.';
      render();
    } catch (error) { setMessage('quote-cart-message','<p class="notice" role="alert">'+esc(error.message || 'Your quote request could not be submitted.')+'</p>'); }
    finally { busy = false; button.disabled = false; button.textContent = 'Submit Quote Request'; }
  }, true);
  migrateLegacy();
  updateCount();
  return { read, add, addPackage, renderPage, updateCount };
})();
