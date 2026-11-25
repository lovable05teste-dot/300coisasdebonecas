const params = new URLSearchParams(location.search);
const plan = params.get('plano');
const complete = plan === 'completo';
const completePrice = params.get('oferta') === 'popup' ? 1990 : 2690;
const subtotal = complete ? completePrice : 1000;
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents) => currency.format(cents / 100);

document.querySelector('#produto').textContent = 'Bonecas de Papel · Pacote ' + (complete ? 'Completo' : 'Básico');
document.querySelector('#preco').textContent = money(subtotal);
document.querySelector('#subtotal').textContent = money(subtotal);

const offers = [...document.querySelectorAll('[name="oferta"]')];
const extrasRow = document.querySelector('#extras');
const total = document.querySelector('#total');

function updateOrder() {
  const extras = offers.reduce((amount, offer) => amount + (offer.checked ? Number(offer.dataset.price) : 0), 0);
  extrasRow.hidden = extras === 0;
  extrasRow.querySelector('dd').textContent = money(extras);
  total.textContent = money(subtotal + extras);
}

for (const offer of offers) offer.addEventListener('change', updateOrder);
updateOrder();

const checkoutForm = document.querySelector('#checkout');
const payButton = document.querySelector('#pagar');
const checkoutStatus = document.querySelector('#estado');
const customerFields = checkoutForm.querySelector('.dados');
const pixResult = document.querySelector('#pix-result');
const pixCode = document.querySelector('#pix-code');
const pixStatus = document.querySelector('#pix-status');

async function enablePayment() {
  try {
    const response = await fetch('/api/pix', { cache: 'no-store' });
    if (!response.ok || !(await response.json()).available) return;
    customerFields.disabled = false;
    payButton.disabled = false;
    checkoutStatus.textContent = '';
  } catch {
    // A prévia estática continua disponível sem a API.
  }
}
enablePayment();

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (payButton.disabled) return;
  const fields = new FormData(checkoutForm);
  const customer = Object.fromEntries(['name', 'email', 'document', 'phone'].map((key) => [key, fields.get(key)]));
  const order = {
    plan: complete ? (completePrice === 1990 ? 'promocional' : 'completo') : 'basico',
    extras: fields.getAll('oferta'),
    customer,
  };

  payButton.disabled = true;
  customerFields.disabled = true;
  for (const item of offers) item.disabled = true;
  checkoutStatus.textContent = 'Gerando Pix…';
  try {
    const response = await fetch('/api/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const result = await response.json();
    if (!response.ok) {
      checkoutStatus.textContent = result.error || 'Não foi possível gerar o Pix.';
      if (response.status === 400) {
        payButton.disabled = false;
        customerFields.disabled = false;
        for (const item of offers) item.disabled = false;
      }
      return;
    }
    pixCode.value = result.code;
    if (result.qr) {
      const qr = document.querySelector('#pix-qr');
      qr.src = result.qr;
      qr.hidden = false;
    }
    pixResult.hidden = false;
    checkoutStatus.textContent = 'Pix gerado.';
    document.querySelector('#pix-title').focus();
    pollPix(result);
  } catch {
    checkoutStatus.textContent = 'Não foi possível confirmar a geração do Pix.';
  }
});

document.querySelector('#copy-pix').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pixCode.value);
    document.querySelector('#copy-pix').textContent = 'Código copiado';
  } catch {
    pixCode.select();
  }
});

function pollPix({ id, token }) {
  const query = new URLSearchParams({ id, token });
  const deadline = Date.now() + 30 * 60 * 1000;
  const pending = new Set(['pending', 'processing', 'antifraud']);
  async function check() {
    try {
      const response = await fetch('/api/pix?' + query, { cache: 'no-store' });
      if (response.ok) {
        const { status } = await response.json();
        if (!pending.has(status)) {
          pixStatus.textContent = status === 'paid' ? 'Pagamento confirmado.' :
            status === 'expired' ? 'Cobrança expirada.' : 'Cobrança encerrada. Status: ' + status;
          return;
        }
      }
    } catch {
      // Falhas transitórias são verificadas na próxima consulta.
    }
    if (Date.now() < deadline) setTimeout(check, 10000);
    else pixStatus.textContent = 'Consulta encerrada. Confira o pagamento no seu banco.';
  }
  setTimeout(check, 10000);
}
