const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const keys = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const origin = 'https://bonecas-paraimprimir-pdf.vercel.app';
const endpoints = {
  utmify: 'https://api.utmify.com.br/api-credentials/orders',
  meta: 'https://graph.facebook.com/v23.0/1462091629424723/events',
};

function sign(value, key) {
  return createHmac('sha256', key).update('pix-attribution:' + value).digest('hex');
}

function postback(order, input, key) {
  const attribution = Object.fromEntries([...keys, '_fbp', '_fbc', 'fbclid'].map((name) =>
    [name, typeof input?.[name] === 'string' ? input[name].slice(0, 160) : null]));
  const context = Buffer.from(JSON.stringify({ attribution, amount: order.amount, items: order.items })).toString('base64url');
  const url = new URL('/api/pix-webhook', origin);
  url.searchParams.set('context', context);
  url.searchParams.set('signature', sign(context, key));
  return url.href;
}

function readContext(query, key) {
  const { context, signature } = query;
  if (typeof context !== 'string' || context.length > 4096 ||
      typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(context, key)))) return null;
  return JSON.parse(Buffer.from(context, 'base64url').toString('utf8'));
}

async function sendPaid(record, context) {
  const { id, customer, paid_at: paidAt, created_at: createdAt } = record;
  const { amount, items, attribution } = context;
  const email = customer?.email?.trim().toLowerCase();
  if (!email || !Number.isFinite(Date.parse(paidAt))) throw new Error('Incomplete paid transaction');
  const date = (value) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  const headers = { 'Content-Type': 'application/json' };
  const send = async (url, credentials, body) => {
    const response = await fetch(url, {
      method: 'POST', headers: { ...headers, ...credentials }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Tracking endpoint returned ' + response.status);
  };

  const requests = [];
  if (process.env.UTMIFY_API_TOKEN) {
    const fee = Number.isInteger(record.fee) && record.fee >= 0 && record.fee <= amount ? record.fee : 0;
    requests.push(send(endpoints.utmify, { 'x-api-token': process.env.UTMIFY_API_TOKEN }, {
      orderId: id, platform: 'InvictusPay', paymentMethod: 'pix', status: 'paid',
      createdAt: date(createdAt || paidAt), approvedDate: date(paidAt), refundedAt: null,
      customer: { name: customer.name, email, phone: customer.phone || null, document: null, country: 'BR' },
      products: items.map((item) => ({
        id: item.description, name: item.description, planId: null, planName: null,
        quantity: item.quantity, priceInCents: item.amount,
      })),
      trackingParameters: Object.fromEntries(keys.map((name) => [name, attribution[name]])),
      commission: { totalPriceInCents: amount, gatewayFeeInCents: fee, userCommissionInCents: amount - fee, currency: 'BRL' },
    }));
  }

  if (process.env.META_CAPI_ACCESS_TOKEN) {
    const userData = { em: [createHash('sha256').update(email).digest('hex')] };
    if (attribution._fbp) userData.fbp = attribution._fbp;
    if (attribution._fbc) userData.fbc = attribution._fbc;
    else if (attribution.fbclid) userData.fbc = 'fb.1.' + Date.parse(createdAt || paidAt) + '.' + attribution.fbclid;
    requests.push(send(endpoints.meta, { Authorization: 'Bearer ' + process.env.META_CAPI_ACCESS_TOKEN }, {
      data: [{
        event_name: 'Purchase', event_id: 'purchase-' + id, event_time: Math.floor(Date.parse(paidAt) / 1000),
        action_source: 'website', event_source_url: origin + '/checkout.html', user_data: userData,
        custom_data: { currency: 'BRL', value: amount / 100, order_id: id },
      }],
    }));
  }
  await Promise.all(requests);
}

module.exports = { postback, readContext, sendPaid };
