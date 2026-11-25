import type { Recipe } from './domain';

export type RecipesPerSheet = 1 | 2 | 4;
export type PrintPagePlan = { recipes: Recipe[]; expanded: boolean };

export function estimatedRecipeLines(recipe: Recipe, includePhoto: boolean) {
  const bath = Math.max(1, recipe.banho_itens.length);
  const observations = Math.max(1, Math.ceil((recipe.observacao?.length ?? 0) / 58));
  return 12 + bath + observations + (includePhoto ? 3 : 0);
}

export function planRecipePages(
  recipes: Recipe[],
  perSheet: RecipesPerSheet,
  includePhotos: boolean,
): { pages: PrintPagePlan[]; expandedCodes: string[] } {
  const pages: PrintPagePlan[] = [];
  const expandedCodes: string[] = [];
  const compactLimit = perSheet === 4 ? 22 : perSheet === 2 ? 39 : 76;
  let compact: Recipe[] = [];
  const flush = () => {
    if (compact.length) pages.push({ recipes: compact, expanded: false });
    compact = [];
  };
  for (const recipe of recipes) {
    if (estimatedRecipeLines(recipe, includePhotos) > compactLimit) {
      flush();
      pages.push({ recipes: [recipe], expanded: true });
      expandedCodes.push(recipe.codigo);
      continue;
    }
    compact.push(recipe);
    if (compact.length === perSheet) flush();
  }
  flush();
  return { pages, expandedCodes };
}
