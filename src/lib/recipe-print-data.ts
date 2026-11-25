import { supabase, fail } from './client';
import type { Recipe, Status, Summary } from './domain';

const PAGE_SIZE = 20;
export type PrintFilters = { term: string; status: Status | ''; order: string };

export async function loadAllRecipeSummaries(filters: PrintFilters, cancelled?:()=>boolean): Promise<Summary[]> {
  const all: Summary[] = [];
  for (let page = 0; page < 10000; page++) {
    if(cancelled?.())throw Error('Operação cancelada.');
    const { data, error } = await supabase.rpc('rama_pesquisar', {
      termo: filters.term,
      situacao: filters.status || null,
      pagina: page,
      ordem: filters.order,
    });
    fail(error);
    const rows = (data ?? []) as Summary[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return Array.from(new Map(all.map((row) => [row.id, row])).values());
  }
  throw Error('A consulta excedeu o limite de segurança. Refine os filtros antes de imprimir.');
}

export async function loadRecipeDetails(ids: string[],cancelled?:()=>boolean): Promise<Recipe[]> {
  const unique = [...new Set(ids)];
  const result: Recipe[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    if(cancelled?.())throw Error('Operação cancelada.');
    const { data, error } = await supabase
      .from('rama_receitas')
      .select('id,codigo,descricao,foto,status,data_atualizacao,versao,velocidade,temperatura,alimentacao,pressao_fourlad,banho_itens,largura,observacao,data_criacao,criado_por,atualizado_por')
      .in('id', unique.slice(offset, offset + 100))
      .is('data_exclusao', null);
    fail(error);
    result.push(...((data ?? []) as Recipe[]));
  }
  const byId = new Map(result.map((recipe) => [recipe.id, recipe]));
  const missing = unique.filter((id) => !byId.has(id));
  if (missing.length) throw Error(`${missing.length} receita(s) deixaram de estar disponíveis durante a geração.`);
  return unique.map((id) => byId.get(id)!);
}

async function imageBlobToPng(blob: Blob) {
  if (blob.type === 'image/png') return new Uint8Array(await blob.arrayBuffer());
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(Error('Falha ao preparar fotografia.'))), 'image/png'),
  );
  return new Uint8Array(await png.arrayBuffer());
}

export async function loadRecipePhotos(recipes: Recipe[], onProgress?: (done: number, total: number) => void,cancelled?:()=>boolean) {
  const targets = recipes.filter((recipe) => recipe.foto);
  const photos = new Map<string, Uint8Array>();
  const failures: string[] = [];
  for (let index = 0; index < targets.length; index++) {
    if(cancelled?.())throw Error('Operação cancelada.');
    const recipe = targets[index];
    const { data, error } = await supabase.storage.from('rama-fotos').download(recipe.foto!);
    if (error || !data) failures.push(recipe.codigo);
    else {
      try { photos.set(recipe.id, await imageBlobToPng(data)); }
      catch { failures.push(recipe.codigo); }
    }
    onProgress?.(index + 1, targets.length);
  }
  return { photos, failures };
}
