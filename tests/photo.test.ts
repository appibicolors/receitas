import { describe, it, expect } from 'vitest';
import { validWebp } from '../supabase/functions/rama-admin/rules';
// WebP 1x1 válido, fixture técnica sem dados de produção.
const image = () =>
  Uint8Array.from(atob('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'), (c) =>
    c.charCodeAt(0),
  );
describe('Upload WebP no backend', () => {
  it('aceita WebP estático compacto', () => expect(validWebp(image())).toBe(true));
  it('rejeita tipo falsificado', () =>
    expect(validWebp(new TextEncoder().encode('<svg onload="alert(1)">'))).toBe(false));
  it('rejeita tamanho RIFF adulterado', () => {
    const bytes = image();
    bytes[4] = 0;
    expect(validWebp(bytes)).toBe(false);
  });
  it('rejeita bitstream truncado', () => expect(validWebp(image().slice(0, 20))).toBe(false));
  it('rejeita imagem acima da dimensão permitida', () => {
    const bytes = image();
    bytes[26] = 255;
    bytes[27] = 63;
    expect(validWebp(bytes)).toBe(false);
  });
});
