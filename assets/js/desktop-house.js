(() => {
  const dialog = document.querySelector('#desktop-house');
  const config = window.SITE_CONFIG?.desktopPet || {};
  let opener;
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    document.querySelector('#house-feedback').textContent = '';
    dialog.showModal();
  }
  document.querySelectorAll('[data-desktop-house]').forEach(button => button.addEventListener('click', open));
  document.addEventListener('desktop-house-open', open);
  dialog.querySelectorAll('.house-close,.house-return').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  function validUrl(value, launch) {
    try {
      const url = new URL(value);
      return launch ? /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && !['javascript:', 'data:', 'file:', 'blob:', 'http:', 'https:'].includes(url.protocol) : url.protocol === 'https:';
    } catch { return false; }
  }
  dialog.querySelectorAll('[data-desktop-link]').forEach(link => {
    const key = link.dataset.desktopLink;
    const value = config[key];
    if (!validUrl(value, key === 'launchUrl')) {
      link.hidden = true;
      dialog.querySelector(key === 'launchUrl' ? '[data-launch-pending]' : '[data-commerce-pending]').hidden = false;
      return;
    }
    link.href = value;
    if (key !== 'launchUrl') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.addEventListener('click', () => {
      document.querySelector('#house-feedback').textContent = '请在浏览器提示中允许打开桌面 APP。如果没有打开，请确认已安装，或通过上方入口重新下载。';
    });
  });
})();
