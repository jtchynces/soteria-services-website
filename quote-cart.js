const QuoteCart = (() => {
  const key = 'soteria-quote-cart-v1';
  const services = ['Installation inquiry', 'Training inquiry', 'Soteria Pulse management inquiry'];
  let busy = false, notice = '';

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return { items:Array.isArray(value.items) ? value.items : [], services:Array.isArray(value.services) ? value.services : [], requestId:typeof value.requestId === 'string' ? value.requestId : '' };
    } catch { return { items:[], services:[], requestId:'' }; }
  }
  function write(cart) { localStorage.setItem(key, JSON.stringify(cart)); updateCount(); }
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
    const rows = cart.items.map((item, index) => {
      const product = catalog.find(entry => entry.id === item.productId);
      const sku = product && AedCatalog.partNumber(product);
      return '<tr><td>'+esc(product?.name || 'Product no longer available')+(sku?'<br><small>Manufacturer part: '+esc(sku)+'</small>':'')+'</td><td><label>Quantity <input type="number" min="1" max="99" value="'+esc(item.quantity)+'" data-quote-quantity="'+index+'"></label></td><td><button class="btn secondary" type="button" data-quote-remove="'+index+'">Remove</button></td></tr>';
    }).join('');
    const selectedServices = cart.services.length ? '<fieldset><legend>Selected services</legend>'+cart.services.map(service=>'<label><input type="checkbox" data-quote-service value="'+esc(service)+'" checked> '+esc(service)+'</label>').join(' ')+'</fieldset>' : '';
    return hero('Quote Cart','Review your equipment and send one request.','Contact Us')+'<section class="section"><div id="quote-cart-notice" role="status">'+(notice?'<p class="notice">'+esc(notice)+'</p>':'')+'</div>'+(cart.items.length?'<div class="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+selectedServices+'<p>Pricing, availability and delivery will be confirmed in your quote.</p><form id="quote-cart-form" class="card"><h2>Contact Information</h2><div class="form-grid"><div class="field"><label for="qc-name">Name</label><input id="qc-name" name="name" required maxlength="150"></div><div class="field"><label for="qc-org">Organization</label><input id="qc-org" name="organization" maxlength="150"></div><div class="field"><label for="qc-email">Email</label><input id="qc-email" name="email" type="email" required maxlength="254"></div><div class="field"><label for="qc-phone">Phone</label><input id="qc-phone" name="phone" type="tel" maxlength="50"></div><div class="field full"><label for="qc-location">Delivery location</label><input id="qc-location" name="deliveryLocation" maxlength="200"></div><div class="field full"><label for="qc-message">Additional instructions</label><textarea id="qc-message" name="message" maxlength="2000"></textarea></div></div><button class="btn" type="submit">Submit Quote Request</button><div id="quote-cart-message" role="status"></div></form>':'<p>Your quote cart is empty.</p>')+'<div class="actions"><a class="btn secondary" href="/shop-equipment" data-link>Continue Shopping</a><a class="btn secondary" href="/cart" data-link>Payment Cart</a></div></section>';
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-quote-add]');
    if (button) {
      const product = products().find(item => item.id === button.dataset.quoteAdd);
      const input = button.closest('article, .card')?.querySelector('[data-quote-card-quantity]');
      try {
        if (!product) throw new Error('This product is no longer available.');
        add([{ productId:product.id, quantity:Number(input?.value || 1) }]);
        button.textContent = 'Added to Quote';
      } catch (error) { button.textContent = error.message; }
    }
    const remove = event.target.closest('[data-quote-remove]');
    if (remove && !busy) { const cart = read(); cart.items.splice(Number(remove.dataset.quoteRemove), 1); if (!cart.items.length) cart.services = []; cart.requestId = ''; write(cart); refreshPreservingContact(); }
    const packageButton = event.target.closest('[data-quote-add-package]');
    if (packageButton) {
      try { const items = configuratorItems(); if (!items.some(item => item.type === 'aed')) throw new Error('Choose an AED first.'); addPackage(items); go('/quote-cart'); }
      catch (error) { setMessage('aed-configurator-message','<div class="notice" role="alert">'+esc(error.message)+'</div>'); }
    }
  });
  document.addEventListener('change', event => {
    if (busy) return;
    if (event.target.matches('[data-quote-service]')) {
      const cart = read(), service = event.target.value;
      if (!event.target.checked) cart.services = cart.services.filter(item => item !== service);
      else if (services.includes(service) && !cart.services.includes(service)) cart.services.push(service);
      cart.requestId = ''; write(cart); return;
    }
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
      if (!cart.items.length) throw new Error('Your quote cart is empty.');
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
  updateCount();
  return { read, add, addPackage, renderPage, updateCount };
})();
