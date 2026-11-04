// Galeria compartida por el panel de anuncios y el dashboard.
// Los contenidos se crean exclusivamente con DOM / textContent.
(() => {
  function safeImageUrl(value, kind) {
    const str = String(value || '');
    return new RegExp(`^/api/announcements/[1-9]\\d*/images/[1-9]\\d*/${kind}$`).test(str)
      ? str : null;
  }

  function openImage(rawUrl, number) {
    const valid = safeImageUrl(rawUrl, 'raw');
    if (!valid) return;
    const overlay = document.createElement('div');
    overlay.className = 'ann-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Imagen ampliada del anuncio');
    const frame = document.createElement('div');
    frame.className = 'ann-lightbox-frame';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ann-lightbox-close';
    close.setAttribute('aria-label', 'Cerrar imagen');
    close.textContent = '×';
    const image = document.createElement('img');
    image.src = valid;
    image.alt = `Imagen ${number} del anuncio en tamaño ampliado`;
    const dismiss = () => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };
    const onKey = event => { if (event.key === 'Escape') dismiss(); };
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKey);
    frame.append(close, image);
    overlay.append(frame);
    document.body.append(overlay);
    close.focus();
  }

  function createGallery(images) {
    const gallery = document.createElement('div');
    gallery.className = 'ann-gallery';
    gallery.setAttribute('aria-label', 'Imágenes del anuncio');
    if (!Array.isArray(images)) return gallery;
    images.slice(0, 4).forEach((item, index) => {
      const thumbUrl = safeImageUrl(item.thumb_url, 'thumb');
      const rawUrl = safeImageUrl(item.raw_url, 'raw');
      if (!thumbUrl || !rawUrl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ann-gallery-thumb';
      btn.title = `Ampliar imagen ${index + 1}`;
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = `Imagen ${index + 1} del anuncio`;
      img.loading = 'lazy';
      btn.append(img);
      btn.addEventListener('click', () => openImage(rawUrl, index + 1));
      gallery.append(btn);
    });
    return gallery;
  }

  window.SoporteAnnouncementGallery = { createGallery };
})();
