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
document.querySelector('#checkout').addEventListener('submit', (event) => event.preventDefault());
updateOrder();
