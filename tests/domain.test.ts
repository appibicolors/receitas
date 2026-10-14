import { describe, it, expect } from 'vitest';
import { maskFeed, decimal, validate, emptyDraft, dateBR } from '../src/lib/domain';
import { isAdministrativeKey } from '../src/lib/public-key';
const good = {
  ...emptyDraft,
  descricao: 'MALHA PIQUET ART. 245 — POLO',
  velocidade: '12,5',
  temperatura: '180',
  alimentacao: 'A1-B2-03-04',
  banho: '3,25',
  largura: '1,5',
};
describe('Validação industrial', () => {
  it('bloqueia chave administrativa no frontend e build', () => {
    expect(isAdministrativeKey('sb_secret_never_use')).toBe(true);
    expect(isAdministrativeKey(`x.${btoa(JSON.stringify({ role: 'service_role' }))}.x`)).toBe(true);
    expect(isAdministrativeKey(`x.${btoa(JSON.stringify({ role: 'anon' }))}.x`)).toBe(false);
    expect(isAdministrativeKey('sb_publishable_allowed')).toBe(false);
  });
  it.each([
    ['a1b20304', 'A1-B2-03-04'],
    ['01-02-03-04', '01-02-03-04'],
    ['AB10CD25', 'AB-10-CD-25'],
    ['', ''],
    ['ab1', 'AB-1'],
  ])('máscara %s', (value, expected) => expect(maskFeed(value)).toBe(expected));
  it('preserva decimais e observação multilinha', () => {
    const r = validate({ ...good, observacao: 'Linha 1\nLinha 2' });
    expect(r.largura).toBe(1.5);
    expect(r.velocidade).toBe(12.5);
    expect(r.banho).toBe(3.25);
    expect(r.observacao).toContain('\n');
  });
  it.each(['1-2-3-4', 'ABC-10-20-30', '01/02/03/04', 'A1-B2-03', 'ab-10-cd-25'])(
    'rejeita alimentação %s',
    (v) => expect(() => validate({ ...good, alimentacao: v })).toThrow(),
  );
  it.each(['180.5', '180,5', '-1', 'NaN', 'Infinity'])('rejeita temperatura %s', (v) =>
    expect(() => validate({ ...good, temperatura: v })).toThrow(),
  );
  it.each(['-2', 'NaN', 'Infinity', '1,2.3', '1e5', ''])('rejeita número %s', (v) =>
    expect(() => decimal(v)).toThrow(),
  );
  it('rejeita largura zero', () => expect(() => validate({ ...good, largura: '0' })).toThrow());
  it('foto opcional e descrição longa', () =>
    expect(validate({ ...good, descricao: 'ARTIGO '.repeat(200) }).foto).toBeNull());
  it('exibe horário de Brasília', () => expect(dateBR('2026-10-14T14:30:00Z')).toContain('11:30'));
});
