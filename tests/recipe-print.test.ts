import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { estimatedRecipeLines, planRecipePages } from '../src/lib/recipe-print-layout';
import type { Recipe } from '../src/lib/domain';

const recipe=(id:number,overrides:Partial<Recipe>={}):Recipe=>({
 id:String(id),codigo:`IBI-REC-${String(id).padStart(3,'0')}`,descricao:`RECEITA ${id}`,foto:null,status:'ATIVA',
 data_atualizacao:'2026-11-25T12:00:00Z',versao:2,velocidade:20.5,temperatura:180,alimentacao:12,
 pressao_fourlad:null,banho_itens:[],largura:null,observacao:'ORIENTAÇÃO COM ACENTUAÇÃO',data_criacao:'2026-11-01T12:00:00Z',criado_por:'a',atualizado_por:'a',...overrides,
});

describe('planejamento de impressão das receitas',()=>{
 it('distribui uma, duas e quatro receitas por folha',()=>{
  const rows=[1,2,3,4,5].map(id=>recipe(id));
  expect(planRecipePages(rows,1,false).pages.map(page=>page.recipes.length)).toEqual([1,1,1,1,1]);
  expect(planRecipePages(rows,2,false).pages.map(page=>page.recipes.length)).toEqual([2,2,1]);
  expect(planRecipePages(rows,4,false).pages.map(page=>page.recipes.length)).toEqual([4,1]);
 });
 it('expande receita extensa em vez de cortar ou sobrepor conteúdo',()=>{
  const long=recipe(1,{banho_itens:Array.from({length:30},(_,i)=>({produto:`PRODUTO ${i}`,quantidade:i+0.25})),observacao:'TEXTO '.repeat(200)});
  const plan=planRecipePages([recipe(2),long,recipe(3)],4,true);
  expect(plan.expandedCodes).toEqual([long.codigo]);
  expect(plan.pages.find(page=>page.expanded)?.recipes).toEqual([long]);
  expect(estimatedRecipeLines(long,true)).toBeGreaterThan(22);
 });
 it('mantém receitas não ativas no lote para receber alerta documental',()=>{
  const rows=[recipe(1,{status:'RASCUNHO'}),recipe(2,{status:'INATIVA'})];
  expect(planRecipePages(rows,2,false).pages[0].recipes.map(row=>row.status)).toEqual(['RASCUNHO','INATIVA']);
 });
});

describe('PDF real',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('gera o mesmo documento vetorial para prévia, download e impressão',async()=>{
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(png,{headers:{'Content-Type':'image/png'}})));
  const {generateRecipePdf}=await import('../src/lib/recipe-pdf');
  const generated=await generateRecipePdf([recipe(1),recipe(2)],new Map(),{perSheet:2,includePhotos:false,showGeneratedAt:true,showVersion:true,showPageNumbers:true,order:'codigo'},'selected');
  expect(generated.filename).toMatch(/^IBICOLORS_RAMA_RECEITAS_SELECIONADAS_\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(generated.bytes.slice(0,4)).toEqual(Uint8Array.from([37,80,68,70]));
  expect((await PDFDocument.load(generated.bytes)).getPageCount()).toBe(1);
 });
});
