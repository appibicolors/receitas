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
  alimentacao: number;
  pressao_fourlad: number | null;
  banho_itens: BathItem[];
  largura: number | null;
  observacao: string;
  data_criacao: string;
  criado_por: string;
  atualizado_por: string;
};
export type BathItem = { quantidade: number; produto: string };
export type DraftBathItem = { quantidade: string; produto: string };
export type Draft = {
  sem_banho: boolean;
  largura_nao_aplicavel: boolean;
  pressao_fourlad_nao_aplicavel: boolean;
  descricao: string;
  foto: string | null;
  velocidade: string;
  temperatura: string;
  alimentacao: string;
  pressao_fourlad: string;
  banho_itens: DraftBathItem[];
  largura: string;
  observacao: string;
  status: Status;
};
export const emptyDraft: Draft = {
  sem_banho: false,
  largura_nao_aplicavel: false,
  pressao_fourlad_nao_aplicavel: false,
  descricao: '',
  foto: null,
  velocidade: '',
  temperatura: '',
  alimentacao: '',
  pressao_fourlad: '',
  banho_itens: [{ quantidade: '', produto: '' }],
  largura: '',
  observacao: '',
  status: 'RASCUNHO',
};
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
  if (!/^[0-9]{1,2}$/.test(d.alimentacao))
    throw Error('Alimentação deve ser um número inteiro de 0 a 99.');
  if (!/^\d+$/.test(d.temperatura) || Number(d.temperatura) > 2147483647)
    throw Error('Temperatura deve ser um número inteiro não negativo.');
  const velocidade = decimal(d.velocidade),
    pressao_fourlad = d.pressao_fourlad_nao_aplicavel ? null : decimal(d.pressao_fourlad),
    largura = d.largura_nao_aplicavel ? null : decimal(d.largura);
  if (!d.sem_banho && !d.banho_itens.length) throw Error('Inclua pelo menos um item no banho.');
  const banho_itens = (d.sem_banho ? [] : d.banho_itens).map((item, index) => {
    const produto = item.produto.trim().toUpperCase();
    if (!produto || /[\r\n]/.test(produto))
      throw Error(`Informe o produto do item ${index + 1} do banho.`);
    try {
      return { produto, quantidade: decimal(item.quantidade) };
    } catch {
      throw Error(`Informe uma quantidade válida em g/L para o item ${index + 1} do banho.`);
    }
  });
  if (largura !== null && largura <= 0) throw Error('Largura deve ser maior que zero.');
  if (!['ATIVA', 'INATIVA', 'RASCUNHO'].includes(d.status)) throw Error('Status inválido.');
  const { sem_banho, largura_nao_aplicavel, pressao_fourlad_nao_aplicavel, ...values } = d;
  void sem_banho;
  void largura_nao_aplicavel;
  void pressao_fourlad_nao_aplicavel;
  return {
    ...values,
    descricao: d.descricao.trim().toUpperCase(),
    observacao: d.observacao.toUpperCase(),
    velocidade,
    pressao_fourlad,
    banho_itens,
    alimentacao: Number(d.alimentacao),
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
    sem_banho: r.banho_itens.length === 0,
    largura_nao_aplicavel: r.largura === null,
    pressao_fourlad_nao_aplicavel: r.pressao_fourlad === null,
    velocidade: String(r.velocidade).replace('.', ','),
    pressao_fourlad: String(r.pressao_fourlad ?? '').replace('.', ','),
    banho_itens: (r.banho_itens.length ? r.banho_itens : [{ produto: '', quantidade: '' }]).map(
      (item) => ({
        produto: item.produto,
        quantidade: String(item.quantidade).replace('.', ','),
      }),
    ),
    alimentacao: String(r.alimentacao),
    largura: String(r.largura ?? '').replace('.', ','),
    temperatura: String(r.temperatura),
  };
}
