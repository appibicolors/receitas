export type Status = 'RASCUNHO' | 'ATIVA' | 'INATIVA';
export type Profile = {
  id: string;
  nome: string;
  email: string;
  perfil: 'SUPERVISOR' | 'OPERADOR';
  ativo: boolean;
};
export type Summary = {
  id: string;
  codigo: string;
  descricao: string;
  foto: string | null;
  status: Status;
  data_atualizacao: string;
  versao: number;
};
export type Recipe = Summary & {
  velocidade: number;
  temperatura: number;
  alimentacao: string;
  banho: number;
  largura: number;
  observacao: string;
  data_criacao: string;
  criado_por: string;
  atualizado_por: string;
};
export type Draft = {
  descricao: string;
  foto: string | null;
  velocidade: string;
  temperatura: string;
  alimentacao: string;
  banho: string;
  largura: string;
  observacao: string;
  status: Status;
};
export const emptyDraft: Draft = {
  descricao: '',
  foto: null,
  velocidade: '',
  temperatura: '',
  alimentacao: '',
  banho: '',
  largura: '',
  observacao: '',
  status: 'RASCUNHO',
};
export function maskFeed(value: string) {
  return (
    value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8)
      .match(/.{1,2}/g)
      ?.join('-') ?? ''
  );
}
export function decimal(value: string) {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim()))
    throw Error('Informe um número válido, usando vírgula ou ponto decimal.');
  const n = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw Error('Número fora do limite.');
  return n;
}
export function validate(d: Draft) {
  if (!d.descricao.trim() || /[\r\n]/.test(d.descricao))
    throw Error('Informe a descrição em uma única linha.');
  if (!/^[A-Z0-9]{2}(-[A-Z0-9]{2}){3}$/.test(d.alimentacao))
    throw Error('Complete a alimentação: XX-XX-XX-XX.');
  if (!/^\d+$/.test(d.temperatura) || Number(d.temperatura) > 2147483647)
    throw Error('Temperatura deve ser um número inteiro não negativo.');
  const velocidade = decimal(d.velocidade),
    banho = decimal(d.banho),
    largura = decimal(d.largura);
  if (largura <= 0) throw Error('Largura deve ser maior que zero.');
  if (!['ATIVA', 'INATIVA', 'RASCUNHO'].includes(d.status)) throw Error('Status inválido.');
  return {
    ...d,
    descricao: d.descricao.trim(),
    velocidade,
    banho,
    largura,
    temperatura: Number(d.temperatura),
  };
}
export const numberBR = (v: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(v);
export const dateBR = (v: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(v));
export function toDraft(r: Recipe): Draft {
  return {
    ...r,
    velocidade: String(r.velocidade).replace('.', ','),
    banho: String(r.banho).replace('.', ','),
    largura: String(r.largura).replace('.', ','),
    temperatura: String(r.temperatura),
  };
}
