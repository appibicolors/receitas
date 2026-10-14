import { supabase, fail } from './client';
export async function compressPhoto(file: File) {
  if (file.size > 10 * 1024 * 1024) throw Error('A foto original deve ter até 10 MB.');
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255,
    png = b.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10',
    webp =
      new TextDecoder().decode(b.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(b.slice(8, 12)) === 'WEBP';
  if (!jpeg && !png && !webp) throw Error('Envie uma foto JPEG, PNG ou WebP válida.');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('Não foi possível comprimir a foto.'))),
      'image/webp',
      0.82,
    ),
  );
  if (blob.type !== 'image/webp' || blob.size > 2097152)
    throw Error('A foto comprimida deve ser WebP com até 2 MB.');
  return blob;
}
export async function uploadPhoto(id: string, file: File) {
  const blob = await compressPhoto(file);
  const body = new FormData();
  body.set('action', 'photo');
  body.set('recipeId', id);
  body.set('file', blob, 'foto.webp');
  const { data, error } = await supabase.functions.invoke('rama-admin', { body });
  fail(error);
  if (data.error) throw Error(data.error);
  return data.path as string;
}
export async function discardPhoto(path: string) {
  const { data, error } = await supabase.functions.invoke('rama-admin', {
    body: { action: 'discardPhoto', path },
  });
  fail(error);
  if (data.error) throw Error(data.error);
}
