const { readContext, sendPaid } = require('../lib/attribution');

module.exports = async function webhook(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const key = process.env.INVICTUSPAY_API_KEY || process.env.NVICTUSPAY_API_KEY;
  if (!key) return res.status(503).json({ ok: false });

  try {
    const context = readContext(req.query, key);
    if (!context) return res.status(403).json({ ok: false });
    if (req.body?.event !== 'EVENT:CHARGE_PAID') return res.status(200).json({ ok: true });
    const id = req.body.transaction?.id;
    if (typeof id !== 'string' || !/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id)) return res.status(400).json({ ok: false });

    const response = await fetch('https://api.invictuspayv2.com.br/api/v1/transactions/' + encodeURIComponent(id), {
      headers: { Accept: 'application/json', 'X-Api-Key': key },
      signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (!response.ok) return res.status(502).json({ ok: false });
    const envelope = await response.json();
    const record = envelope.data ?? envelope.transaction ?? envelope;
    if (record.id !== id || record.amount !== context.amount || record.payment_method !== 'pix' || record.status !== 'paid') {
      return res.status(409).json({ ok: false });
    }
    await sendPaid(record, context);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false });
  }
};
