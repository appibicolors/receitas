// Verificação estrutural do contêiner/bitstream WebP além de extensão e MIME.
export function validWebp(bytes: Uint8Array) {
  if (bytes.length < 20 || bytes.length > 2097152) return false;
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    text(0, 4) !== 'RIFF' ||
    text(8, 12) !== 'WEBP' ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    return false;
  let image = false;
  for (let position = 12; position < bytes.length;) {
    if (position + 8 > bytes.length) return false;
    const type = text(position, position + 4),
      size = view.getUint32(position + 4, true),
      start = position + 8;
    const end = start + size;
    if (end > bytes.length || type === 'ANIM' || type === 'ANMF') return false;
    let width = 0,
      height = 0;
    if (type === 'VP8 ') {
      if (
        size < 10 ||
        bytes[start + 3] !== 157 ||
        bytes[start + 4] !== 1 ||
        bytes[start + 5] !== 42
      )
        return false;
      width = view.getUint16(start + 6, true) & 16383;
      height = view.getUint16(start + 8, true) & 16383;
    } else if (type === 'VP8L') {
      if (size < 5 || bytes[start] !== 47) return false;
      const bits = view.getUint32(start + 1, true);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
    if (type === 'VP8 ' || type === 'VP8L') {
      if (image || width < 1 || height < 1 || width > 1200 || height > 1200) return false;
      image = true;
    }
    position = end + (size % 2);
    if (position > bytes.length) return false;
  }
  return image;
}
