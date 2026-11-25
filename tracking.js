window.pixelId = '6b07220b926a0fe447603ae6';

for (const [url, attributes] of [
  ['https://cdn.utmify.com.br/scripts/pixel/pixel.js', []],
  ['https://cdn.utmify.com.br/scripts/utms/latest.js', ['data-utmify-prevent-xcod-sck', 'data-utmify-prevent-subids']],
]) {
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  for (const attribute of attributes) script.setAttribute(attribute, '');
  document.head.append(script);
}

if (!window.fbq) {
  const pixel = function () {
    if (pixel.callMethod) pixel.callMethod.apply(pixel, arguments);
    else pixel.queue.push(arguments);
  };
  window.fbq = window._fbq = pixel;
  pixel.push = pixel;
  pixel.loaded = true;
  pixel.version = '2.0';
  pixel.queue = [];
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.append(script);
  pixel('init', '1462091629424723');
  pixel('track', 'PageView');
}
