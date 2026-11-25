import { supabase, fail } from './client';

export type ProductSuggestion = { produto: string; frequencia: number };

const cache = new Map<string, ProductSuggestion[]>();

function cacheKey(term: string) {
  return term.trim().toLocaleUpperCase('pt-BR');
}

export async function suggestProducts(term: string, signal?: AbortSignal) {
  const key = cacheKey(term);
  const cached = cache.get(key);
  if (cached) return cached;

  const request = supabase.rpc('rama_sugerir_produtos', { termo: term.trim(), limite: 10 });
  const { data, error } = signal ? await request.abortSignal(signal) : await request;
  fail(error);
  const suggestions = ((data ?? []) as ProductSuggestion[]).map((row) => ({
    produto: row.produto,
    frequencia: Number(row.frequencia),
  }));
  cache.set(key, suggestions);
  return suggestions;
}

export function clearProductSuggestionCache() {
  cache.clear();
}
