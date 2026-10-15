import { describe, it, expect } from 'vitest';
import { decimal, validate, emptyDraft, dateBR, toDraft, type Recipe } from '../src/lib/domain';
import { isAdministrativeKey } from '../src/lib/public-key';
const good = {
  ...emptyDraft,
  descricao: 'MALHA PIQUET ART. 245 — POLO',
  velocidade: '12,5',
  temperatura: '180',
  alimentacao: '12',
  pressao_fourlad: '4,5',
  banho_itens: [
    { quantidade: '40', produto: 'Silicone' },
    { quantidade: '5', produto: 'Graxo' },
    { quantidade: '50', produto: 'Talco baby' },
  ],
  largura: '1,5',
};
describe('Validação industrial', () => {
  it('bloqueia chave administrativa no frontend e build', () => {
    expect(isAdministrativeKey('sb_secret_never_use')).toBe(true);
    expect(isAdministrativeKey(`x.${btoa(JSON.stringify({ role: 'service_role' }))}.x`)).toBe(true);
    expect(isAdministrativeKey(`x.${btoa(JSON.stringify({ role: 'anon' }))}.x`)).toBe(false);
    expect(isAdministrativeKey('sb_publishable_allowed')).toBe(false);
  });
  it.each(['0', '1', '9', '10', '99', '00'])('aceita alimentação inteira %s', (value) =>
    expect(validate({ ...good, alimentacao: value }).alimentacao).toBe(Number(value)),
  );
  it('preserva decimais e observação multilinha', () => {
    const r = validate({ ...good, observacao: 'Linha 1\nLinha 2' });
    expect(r.largura).toBe(1.5);
    expect(r.velocidade).toBe(12.5);
    expect(r.pressao_fourlad).toBe(4.5);
    expect(r.banho_itens).toEqual([
      { quantidade: 40, produto: 'Silicone' },
      { quantidade: 5, produto: 'Graxo' },
      { quantidade: 50, produto: 'Talco baby' },
    ]);
    expect(r.observacao).toContain('\n');
  });
  it.each(['100', '001', '-1', '1,5', '1.5', '1e1', 'AB', 'A1-B2-03-04', ''])(
    'rejeita alimentação %s',
    (v) => expect(() => validate({ ...good, alimentacao: v })).toThrow(),
  );
  it('exige pelo menos um item completo no banho', () => {
    expect(() => validate({ ...good, banho_itens: [] })).toThrow();
    expect(() => validate({ ...good, banho_itens: [{ quantidade: '1', produto: ' ' }] })).toThrow();
    expect(() =>
      validate({ ...good, banho_itens: [{ quantidade: '-1', produto: 'Silicone' }] }),
    ).toThrow();
    expect(() =>
      validate({ ...good, banho_itens: [{ quantidade: '', produto: 'Silicone' }] }),
    ).toThrow();
  });
  it('aceita doses decimais e normaliza nomes dos produtos', () =>
    expect(
      validate({ ...good, banho_itens: [{ quantidade: '5,25', produto: '  Graxo  ' }] })
        .banho_itens,
    ).toEqual([{ quantidade: 5.25, produto: 'Graxo' }]));
  it.each(['', '-1', 'NaN', 'Infinity'])('rejeita pressão Fourlad inválida %s', (value) =>
    expect(() => validate({ ...good, pressao_fourlad: value })).toThrow(),
  );
  it('carrega pressão, alimentação e todos os itens ao editar', () => {
    const r = {
      ...validate(good),
      id: 'test',
      codigo: 'IBI-REC-001',
      data_atualizacao: '2026-10-15T12:00:00Z',
      versao: 1,
      data_criacao: '2026-10-15T12:00:00Z',
      criado_por: 'test',
      atualizado_por: 'test',
    } satisfies Recipe;
    const d = toDraft(r);
    expect(d.pressao_fourlad).toBe('4,5');
    expect(d.alimentacao).toBe('12');
    expect(d.banho_itens).toEqual(good.banho_itens);
  });
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
