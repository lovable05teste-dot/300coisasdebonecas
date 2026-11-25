const { createHmac, timingSafeEqual } = require('node:crypto');
const QRCode = require('qrcode');

const endpoint = 'https://api.invictuspayv2.com.br/api/v1/transactions';
const plans = {
  basico: ['Pacote Básico', 1000],
  completo: ['Pacote Completo', 2690],
  promocional: ['Pacote Completo com desconto', 1990],
};
const extras = {
  colorir: ['Bobbie Goods', 690],
  cenarios: ['Acessórios e Cenários', 590],
  gamer: ['Kit Roblox', 490],
  princesas: ['Edição Princesas', 490],
};
const transactionId = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const statuses = new Set(['pending', 'processing', 'antifraud', 'paid', 'failed', 'refused', 'expired', 'cancelled', 'refunded', 'in_dispute', 'pre_chargeback', 'chargeback']);

function signature(id, key) {
  return createHmac('sha256', key).update('mundo-de-papel:pix:' + id).digest('hex');
}

function order(body) {
  if (!body || !Object.hasOwn(plans, body.plan) || !Array.isArray(body.extras) ||
      body.extras.length > 4 || body.extras.some((item) => typeof item !== 'string' || !Object.hasOwn(extras, item))) return null;
  const input = body.customer || {};
  const field = (name) => typeof input[name] === 'string' ? input[name].trim() : '';
  const customer = {
    name: field('name'),
    email: field('email'),
    document: field('document').replace(/\D/g, ''),
    phone: field('phone').replace(/\D/g, ''),
  };
  if (customer.name.length < 3 || customer.name.length > 100 || customer.email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
      !/^(?:\d{11}|\d{14})$/.test(customer.document) || !/^\d{10,11}$/.test(customer.phone)) return null;
  const items = [plans[body.plan], ...[...new Set(body.extras)].map((item) => extras[item])]
    .map(([description, amount]) => ({ description, amount, quantity: 1 }));
  return { amount: items.reduce((sum, item) => sum + item.amount, 0), paymentMethod: 'pix', customer, items, pix: { expirationInSeconds: 1800 } };
}

module.exports = async function pix(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.INVICTUSPAY_API_KEY || process.env.NVICTUSPAY_API_KEY;
  if (!key) return res.status(503).json({ error: 'Pagamento Pix indisponível.' });

  try {
    const headers = { 'X-Api-Key': key, Accept: 'application/json' };
    const options = { headers, signal: AbortSignal.timeout(10000), redirect: 'error' };
    if (req.method === 'GET') {
      const { id, token } = req.query;
      if (!id && !token) return res.status(200).json({ available: true });
      if (typeof id !== 'string' || !transactionId.test(id) || typeof token !== 'string' ||
          !/^[a-f0-9]{64}$/.test(token) ||
          !timingSafeEqual(Buffer.from(token), Buffer.from(signature(id, key)))) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }
      const response = await fetch(endpoint + '/' + encodeURIComponent(id), options);
      if (!response.ok) return res.status(502).json({ error: 'Não foi possível consultar o pagamento.' });
      const envelope = await response.json();
      const record = envelope.data ?? envelope.transaction ?? envelope;
      if (!statuses.has(record.status)) return res.status(502).json({ error: 'Status não reconhecido.' });
      return res.status(200).json({ status: record.status });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Método não permitido.' });
    }
    const purchase = order(req.body);
    if (!purchase) return res.status(400).json({ error: 'Confira os dados e os itens da compra.' });

    const response = await fetch(endpoint, {
      ...options,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(purchase),
    });
    if (!response.ok) return res.status(502).json({ error: 'A InvictusPay não confirmou a geração do Pix.' });
    const envelope = await response.json();
    const record = envelope.data ?? envelope.transaction ?? envelope;
    const id = record.id;
    // A documentação enviada não inclui um exemplo do retorno de criação do Pix.
    const code = record.pix?.qrCode ?? record.pix?.qr_code ?? record.pix?.copyPaste ?? record.pix?.copy_paste;
    if (typeof id !== 'string' || !transactionId.test(id) ||
        typeof code !== 'string' || !code.startsWith('000201') || code.length > 1024) {
      return res.status(502).json({ error: 'A cobrança pode ter sido criada, mas o código Pix não pôde ser exibido.' });
    }
    const qr = await QRCode.toDataURL(code, { width: 224 }).catch(() => null);
    return res.status(201).json({ id, token: signature(id, key), code, qr });
  } catch {
    return res.status(502).json({ error: 'Não foi possível confirmar a operação com a InvictusPay.' });
  }
};
