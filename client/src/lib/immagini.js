// Ridimensiona una foto nel browser prima di caricarla: le foto del
// telefono pesano 3-8 MB, in bacheca ne bastano 1280 px. Così l'upload
// è veloce, il server non deve elaborare nulla e si resta sotto il
// limite di 1 MB di Nginx. Esce sempre un JPEG; se serve si abbassa la
// qualità finché non si sta sotto maxByte.

const MAX_LATO = 1280;
const MAX_BYTE = 900 * 1024;

async function caricaBitmap(file) {
  // imageOrientation: 'from-image' applica l'orientamento EXIF (foto
  // scattate in verticale), supportato dai browser recenti.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* si prova con <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile.')) };
    img.src = url;
  });
}

function aBlob(canvas, qualita) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualita));
}

export async function ridimensionaImmagine(file, { maxLato = MAX_LATO, maxByte = MAX_BYTE } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Scegli un file immagine (JPG, PNG...).');
  const bitmap = await caricaBitmap(file);
  const larg = bitmap.width;
  const alt = bitmap.height;
  const scala = Math.min(1, maxLato / Math.max(larg, alt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(larg * scala);
  canvas.height = Math.round(alt * scala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // i PNG trasparenti diventano JPEG su bianco
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  let blob = null;
  for (const qualita of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    blob = await aBlob(canvas, qualita);
    if (blob && blob.size <= maxByte) break;
  }
  if (!blob) throw new Error('Impossibile elaborare l\'immagine.');
  if (blob.size > maxByte) throw new Error('Immagine troppo grande anche dopo la riduzione: prova con un\'altra foto.');
  return blob;
}
