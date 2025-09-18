const sharp = require('sharp');

async function normalizeToJpgWithThumb(buffer){
  const big = await sharp(buffer).rotate()
    .resize({ width:640, height:480, fit:'inside', withoutEnlargement:true })
    .jpeg({ quality:80, mozjpeg:true })
    .toBuffer({ resolveWithObject:true });

  const small = await sharp(big.data).resize({ width:240, height:180, fit:'inside', withoutEnlargement:true })
    .jpeg({ quality:70, mozjpeg:true })
    .toBuffer({ resolveWithObject:true });

  return {
    data: big.data, thumb: small.data,
    width: big.info.width, height: big.info.height,
    size: big.data.length, mime: 'image/jpeg'
  };
}
module.exports = { normalizeToJpgWithThumb };
