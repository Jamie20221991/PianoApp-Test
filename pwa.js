const installButton = document.getElementById('install-btn');
const installDialog = document.getElementById('install-dialog');
const installHelp = document.getElementById('install-help');
let installPrompt;

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

if (isStandalone) {
  installButton.hidden = true;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    installHelp.textContent = isIos
      ? 'In Safari, tap Share, then choose “Add to Home Screen”.'
      : 'Open your browser menu and choose “Install Glow Piano” or “Add to Home screen”.';
    installDialog.showModal();
    return;
  }

  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  installPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Glow Piano could not enable offline support.', error);
    });
  });
}
