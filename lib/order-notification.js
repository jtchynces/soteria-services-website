const { sendMail, notificationRecipient } = require('./mail');

function money(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format((Number(cents) || 0) / 100);
}

function addressLines(address, name) {
  if (!address) return [];
  return [
    name || address.name || '',
    address.line1 || '',
    address.line2 || '',
    [address.city, address.state || address.province, address.postal_code || address.postalCode].filter(Boolean).join(', '),
    address.country || ''
  ].filter(Boolean);
}

function lineFromStripe(line) {
  const product = line.price && line.price.product && typeof line.price.product === 'object' ? line.price.product : {};
  const meta = product.metadata || {};
  const quantity = Number(line.quantity) || 0;
  const unit = Number(line.price && line.price.unit_amount) || 0;
  return {
    name: line.description || product.name || '',
    partNumber: meta.part_number || '',
    quantity,
    unitAmount: unit,
    lineAmount: unit * quantity
  };
}

async function notifyPaidOrder(stripe, event) {
  const to = notificationRecipient();
  const sessionId = event && event.data && event.data.object && event.data.object.id;
  if (!sessionId) {
    console.warn('[order-email] Completed checkout had no session id. Email not sent.');
    return { skipped: true, reason: 'session' };
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product']
  });
  const details = session.customer_details || {};
  const shipping = session.shipping_details || session.collected_information && session.collected_information.shipping_details || {};
  const meta = session.metadata || {};
  const lines = ((session.line_items && session.line_items.data) || []).map(lineFromStripe);
  const tax = session.total_details && session.total_details.amount_tax;
  const shippingAmount = session.total_details && session.total_details.amount_shipping;
  const installationRequested = meta.installation_requested === 'yes';
  const formAddress = [meta.shipping_line1, meta.shipping_city, meta.shipping_province, meta.shipping_postal, 'CA'].filter(Boolean);
  const stripeAddress = addressLines(shipping.address, shipping.name || details.name);

  const itemLines = lines.map((line) => [
    line.name,
    line.partNumber ? `Part ${line.partNumber}` : 'Part number not recorded',
    `Qty ${line.quantity}`,
    `Unit ${money(line.unitAmount)}`,
    `Line ${money(line.lineAmount)}`
  ].join(' | '));

  const text = [
    'A Soteria test-mode checkout was completed. Place the supplier order with SOS only after you confirm stock, tax, and the shipping address.',
    '',
    `Customer: ${details.name || meta.customer_name || ''}`,
    `Email: ${details.email || session.customer_email || ''}`,
    `Phone: ${details.phone || meta.phone || ''}`,
    `Organization: ${meta.organization || ''}`,
    '',
    'Stripe shipping address:',
    ...(stripeAddress.length ? stripeAddress : ['Not collected']),
    '',
    'Address entered for installation eligibility:',
    ...(formAddress.length ? formAddress : ['Not collected']),
    '',
    `Installation requested: ${installationRequested ? 'Yes' : 'No'}`,
    installationRequested ? 'AED pad serial numbers are recorded on site at installation.' : '',
    '',
    'Items:',
    ...(itemLines.length ? itemLines : ['No line items were returned by Stripe.']),
    '',
    `Shipping: ${money(shippingAmount || 0)}${meta.shipping_placeholder === 'true' ? ' (placeholder flat rate, not final)' : ''}`,
    `Tax: ${money(tax || 0)}${tax ? '' : ' (tax is not configured in Stripe yet; confirm before the supplier order)'}`,
    `Total: ${money(session.amount_total || 0)}`,
    `Currency: ${(session.currency || 'cad').toUpperCase()}`,
    `Stripe session: ${session.id}`
  ].filter((line) => line !== '').join('\n');

  try {
    return await sendMail({
      to,
      subject: `Soteria order ${session.id}`,
      text,
      html: `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`
    });
  } catch (error) {
    console.error('[order-email] Provider failed. The order was not rejected.', error);
    return { skipped: true, reason: 'provider_error' };
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
}

module.exports = { notifyPaidOrder };
