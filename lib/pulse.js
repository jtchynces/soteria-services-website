function normalizeLeadOrder(input) {
  return {
    source: 'marketing_website',
    type: input.type || 'quote_request',
    customer: input.customer || '',
    organization: input.organization || '',
    email: input.email || '',
    phone: input.phone || '',
    product: input.product || '',
    category: input.category || '',
    amount: input.amount || 0,
    status: input.status || 'new',
    notes: input.notes || '',
    stripe_checkout_session_id: input.stripe_checkout_session_id || '',
    stripe_payment_intent_id: input.stripe_payment_intent_id || '',
    created_at: input.created_at || new Date().toISOString()
  };
}

async function syncToPulse(normalizedRecord) {
  // Integration boundary for Soteria Pulse when the Pulse API is available.
  // Do not hardcode API keys here. Use environment variables/server-side secret storage.
  return { ok: false, queued: true, record: normalizedRecord };
}

module.exports = { normalizeLeadOrder, syncToPulse };
