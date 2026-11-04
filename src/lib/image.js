const sharp = require('sharp');

// V1.5: se conserva la orientacion y proporcion de la imagen.
// Limite: 1600 px de ancho y 1200 px de alto (nunca se amplia la fuente).
// Esta funcion se utiliza tanto para tickets como para anuncios.
async function normalizeToJpgWithThumb(buffer, options = {}) {
  const thumbWidth = options.thumbWidth || 240;
  const thumbHeight = options.thumbHeight || 180;
  const big = await sharp(buffer, { limitInputPixels: 40000000 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const small = await sharp(big.data)
    .resize({ width: thumbWidth, height: thumbHeight, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();

  return {
    data: big.data,
    thumb: small,
    width: big.info.width,
    height: big.info.height,
    size: big.data.length,
    mime: 'image/jpeg'
  };
}

module.exports = { normalizeToJpgWithThumb };
