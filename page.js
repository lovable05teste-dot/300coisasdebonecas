const video = document.querySelector('video');
const sound = document.querySelector('[aria-label="Ativar o som"]');
const progress = video.parentElement.querySelector('[style^="width:"]');

sound.addEventListener('click', async () => {
  video.currentTime = 0;
  video.loop = false;
  video.muted = false;
  try {
    await video.play();
    sound.hidden = true;
    sound.style.display = 'none';
    video.controls = true;
    video.focus();
  } catch {
    video.controls = true;
    sound.style.display = 'none';
  }
});

video.addEventListener('timeupdate', () => {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    progress.style.width = `${video.currentTime / video.duration * 100}%`;
  }
});

const questions = document.querySelectorAll('[aria-controls^="faq-"]');
for (const question of questions) {
  question.addEventListener('click', () => {
    const shouldOpen = question.getAttribute('aria-expanded') === 'false';
    for (const item of questions) {
      const open = item === question && shouldOpen;
      item.setAttribute('aria-expanded', String(open));
      item.querySelector('span').classList.toggle('rotate-180', open);
      document.getElementById(item.getAttribute('aria-controls')).hidden = !open;
    }
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
for (const carousel of document.querySelectorAll('.cursor-grab')) {
  const track = carousel.firstElementChild;
  let offset = 0;
  let drag = null;
  let resumeAt = 0;
  let previousTime = 0;

  for (const image of track.querySelectorAll('img')) {
    image.draggable = false;
  }

  carousel.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    drag = { pointerId: event.pointerId, x: event.clientX, offset };
    carousel.setPointerCapture(event.pointerId);
  });

  carousel.addEventListener('pointermove', (event) => {
    if (drag?.pointerId === event.pointerId) {
      offset = drag.offset + drag.x - event.clientX;
    }
  });

  function endDrag(event) {
    if (drag?.pointerId === event.pointerId) {
      drag = null;
      resumeAt = performance.now() + 800;
    }
  }

  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);
  carousel.addEventListener('lostpointercapture', endDrag);

  function advance(time) {
    const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
    previousTime = time;
    const length = track.scrollWidth / 2;
    if (length > 0) {
      if (!drag && !reducedMotion.matches && time >= resumeAt) offset += elapsed * 0.125;
      offset = ((offset % length) + length) % length;
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    }
    requestAnimationFrame(advance);
  }

  requestAnimationFrame(advance);
}

const countdown = document.querySelector('#offer-countdown');
const countdownDeadline = Date.now() + 15 * 60 * 1000;
const countdownInterval = setInterval(() => {
  const secondsLeft = Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000));
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  countdown.textContent = `${minutes}:${seconds}`;
  if (secondsLeft === 0) clearInterval(countdownInterval);
}, 1000);

const basicOffer = document.querySelector('#oferta-basico');
const upgradeOffer = document.querySelector('#oferta-completo');
basicOffer.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  upgradeOffer.showModal();
});
