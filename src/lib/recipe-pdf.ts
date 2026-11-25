import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { Recipe } from './domain';
import { numberBR } from './domain';
import { planRecipePages, type RecipesPerSheet } from './recipe-print-layout';
import logoUrl from '../assets/ibicolor-logo.png';
import robotoRegular from '@fontsource/roboto/files/roboto-latin-400-normal.woff?inline';
import robotoBold from '@fontsource/roboto/files/roboto-latin-700-normal.woff?inline';

export type RecipePdfOptions = {
  perSheet: RecipesPerSheet;
  includePhotos: boolean;
  showGeneratedAt: boolean;
  showVersion: boolean;
  showPageNumbers: boolean;
  order: 'codigo' | 'descricao';
};
type Fonts = { normal: PDFFont; bold: PDFFont };
type CardResult = { remaining: string[] };
const A4 = PageSizes.A4;
const ink = rgb(0.06, 0.14, 0.26), muted = rgb(0.34, 0.42, 0.53), blue = rgb(0.05, 0.34, 0.75);
const pdfText=(value:string)=>String(value).replace(/[–—‑]/g,'-');

function dataUrlBytes(value: string) {
  const encoded = value.slice(value.indexOf(',') + 1);
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfText(String(text || '-')).replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function technicalLines(recipe: Recipe, font: PDFFont, size: number, width: number) {
  const notApplicable = 'NÃO APLICÁVEL';
  const lines = [
    `Velocidade: ${numberBR(recipe.velocidade)} m/min  |  Temperatura: ${numberBR(recipe.temperatura)} °C`,
    `Alimentação: ${recipe.alimentacao}  |  Pressão Fourlad: ${recipe.pressao_fourlad === null ? notApplicable : `${numberBR(recipe.pressao_fourlad)} kgf/cm²`}`,
    `Largura: ${recipe.largura === null ? notApplicable : `${numberBR(recipe.largura)} m`}`,
    '',
    'COMPOSIÇÃO DO BANHO',
  ];
  if (!recipe.banho_itens.length) lines.push('SEM BANHO');
  else recipe.banho_itens.forEach((item) => lines.push(pdfText(`${numberBR(item.quantidade)} g/L - ${item.produto}`)));
  lines.push('', 'ORIENTAÇÕES E OBSERVAÇÕES');
  return lines.concat(wrap(recipe.observacao || 'Nenhuma observação informada.', font, size, width));
}

function drawLines(page: PDFPage, lines: string[], x: number, startY: number, width: number, bottom: number, fonts: Fonts, size: number) {
  const lineHeight = size * 1.32;
  let y = startY, index = 0;
  for (; index < lines.length; index++) {
    if (y - lineHeight < bottom) break;
    const line = lines[index];
    const heading = line === 'COMPOSIÇÃO DO BANHO' || line === 'ORIENTAÇÕES E OBSERVAÇÕES';
    if (line) page.drawText(line,{x,y,size:heading?size*0.92:size,font:heading?fonts.bold:fonts.normal,color:heading?blue:ink,maxWidth:width});
    y -= lineHeight;
  }
  return { y, remaining: lines.slice(index) };
}

function drawCard(page: PDFPage, recipe: Recipe, bounds: {x:number;y:number;width:number;height:number}, fonts: Fonts, logo: PDFImage, photo: PDFImage|undefined, options: RecipePdfOptions, continuation = false, suppliedLines?: string[]): CardResult {
  const compact = options.perSheet === 4 && !continuation;
  const size = compact ? 7.3 : options.perSheet === 2 && !continuation ? 8.5 : 9.4;
  const padding = compact ? 10 : 14;
  page.drawRectangle({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,borderColor:rgb(0.77,0.82,0.89),borderWidth:0.8,color:rgb(1,1,1)});
  const top = bounds.y + bounds.height - padding;
  page.drawImage(logo,{x:bounds.x+padding,y:top-20,width:20,height:20});
  page.drawText(continuation ? `${recipe.codigo} - CONTINUAÇÃO` : recipe.codigo,{x:bounds.x+padding+26,y:top-11,font:fonts.bold,size:compact?10:12,color:ink});
  const statusText = recipe.status === 'RASCUNHO' ? 'RASCUNHO - NÃO LIBERADA PARA PRODUÇÃO' : recipe.status === 'INATIVA' ? 'INATIVA - NÃO UTILIZAR NA PRODUÇÃO' : 'ATIVA';
  const statusColor = recipe.status === 'ATIVA' ? rgb(0.08,0.48,0.28) : rgb(0.73,0.18,0.12);
  page.drawText(statusText,{x:bounds.x+bounds.width-padding-fonts.bold.widthOfTextAtSize(statusText,compact?6:7),y:top-10,font:fonts.bold,size:compact?6:7,color:statusColor});
  let cursor = top - 30;
  if (!continuation) {
    const descLines = wrap(recipe.descricao,fonts.bold,compact?8.2:10.2,bounds.width-padding*2);
    descLines.slice(0,compact?2:3).forEach((line) => { page.drawText(line,{x:bounds.x+padding,y:cursor,font:fonts.bold,size:compact?8.2:10.2,color:ink});cursor-=compact?10:13; });
    const meta = `${options.showVersion?`Versão ${recipe.versao} · `:''}Atualizada em ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date(recipe.data_atualizacao))}`;
    page.drawText(meta,{x:bounds.x+padding,y:cursor,font:fonts.normal,size:compact?6.4:7.4,color:muted});cursor-=compact?11:14;
  }
  let textWidth = bounds.width-padding*2;
  if (!continuation && photo) {
    const maxW = Math.min(compact?58:95,bounds.width*0.25), maxH = compact?46:72;
    const ratio = Math.min(maxW/photo.width,maxH/photo.height);
    const w=photo.width*ratio,h=photo.height*ratio;
    page.drawImage(photo,{x:bounds.x+bounds.width-padding-w,y:cursor-h+5,width:w,height:h});
    textWidth -= w + 10;
  }
  const lines = suppliedLines ?? technicalLines(recipe,fonts.normal,size,textWidth);
  const drawn = drawLines(page,lines,bounds.x+padding,cursor,textWidth,bounds.y+padding,fonts,size);
  return { remaining: drawn.remaining };
}

function filename(kind: 'individual'|'selected'|'all', first?: Recipe) {
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  if (kind === 'individual' && first) return `IBICOLORS_RAMA_${first.codigo}.pdf`;
  return kind === 'all' ? `IBICOLORS_RAMA_TODAS_RECEITAS_${day}.pdf` : `IBICOLORS_RAMA_RECEITAS_SELECIONADAS_${day}.pdf`;
}

export async function generateRecipePdf(recipesInput: Recipe[], photos: Map<string,Uint8Array>, options: RecipePdfOptions, kind: 'individual'|'selected'|'all') {
  const recipes=[...recipesInput].sort((a,b)=>(options.order==='descricao'?a.descricao.localeCompare(b.descricao,'pt-BR'):a.codigo.localeCompare(b.codigo,'pt-BR')));
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const normal=await pdf.embedFont(dataUrlBytes(robotoRegular),{subset:true});
  const bold=await pdf.embedFont(dataUrlBytes(robotoBold),{subset:true});
  const logo=await pdf.embedPng(await fetch(logoUrl).then((response)=>response.arrayBuffer()));
  const embeddedPhotos=new Map<string,PDFImage>();
  for(const [id,bytes] of photos) embeddedPhotos.set(id,await pdf.embedPng(bytes));
  const fonts={normal,bold}, {pages:plans,expandedCodes}=planRecipePages(recipes,options.perSheet,options.includePhotos);
  for(const plan of plans){
    const page=pdf.addPage(A4),[pageWidth,pageHeight]=A4,margin=24,gap=10;
    const count=plan.expanded?1:options.perSheet,columns=count===4?2:1,rows=count===1?1:2;
    const cardW=(pageWidth-margin*2-gap*(columns-1))/columns,cardH=(pageHeight-margin*2-gap*(rows-1))/rows;
    plan.recipes.forEach((recipe,index)=>{
      const col=index%columns,row=Math.floor(index/columns),x=margin+col*(cardW+gap),y=pageHeight-margin-(row+1)*cardH-row*gap;
      let remaining=drawCard(page,recipe,{x,y,width:cardW,height:cardH},fonts,logo,options.includePhotos?embeddedPhotos.get(recipe.id):undefined,options).remaining;
      while(remaining.length){const continuation=pdf.addPage(A4);remaining=drawCard(continuation,recipe,{x:margin,y:margin,width:pageWidth-margin*2,height:pageHeight-margin*2},fonts,logo,undefined,{...options,perSheet:1},true,remaining).remaining;}
    });
  }
  const generated=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date());
  pdf.getPages().forEach((page,index)=>{if(options.showGeneratedAt)page.drawText(`Gerado em ${generated}`,{x:26,y:10,size:6.5,font:normal,color:muted});if(options.showPageNumbers){const label=`Página ${index+1} de ${pdf.getPageCount()}`;page.drawText(label,{x:A4[0]-26-normal.widthOfTextAtSize(label,6.5),y:10,size:6.5,font:normal,color:muted});}});
  return { bytes:await pdf.save(),pageCount:pdf.getPageCount(),filename:filename(kind,recipes[0]),warnings:expandedCodes.map((code)=>`${code}: conteúdo extenso expandido para preservar a leitura.`) };
}
