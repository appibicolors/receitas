import { test, expect, type Page } from '@playwright/test';
const operator = '00000000-0000-0000-0000-000000000002';
const recipe = {
  id: '10000000-0000-0000-0000-000000000001',
  codigo: 'IBI-REC-001',
  descricao: 'MALHA PIQUET ART. 245 AZUL MARINHO — POLO',
  foto: null,
  status: 'ATIVA',
  versao: 1,
  data_atualizacao: '2026-10-14T14:00:00Z',
  data_criacao: '2026-10-14T14:00:00Z',
  criado_por: operator,
  atualizado_por: operator,
  velocidade: 12.5,
  temperatura: 180,
  alimentacao: 12,
  pressao_fourlad: 4.5,
  banho_itens: [
    { quantidade: 40, produto: 'Silicone' },
    { quantidade: 5, produto: 'Graxo' },
    { quantidade: 50, produto: 'Talco baby' },
  ],
  largura: 1.5,
  observacao: 'Linha 1\nLinha 2',
};
async function mock(page: Page, role = 'OPERADOR', authorized = true) {
  await page.addInitScript(
    ({ operator }) => {
      localStorage.setItem(
        'ibicolor-rama-session',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: { id: operator, email: 'operador@example.test' },
        }),
      );
    },
    { operator },
  );
  await page.route('https://rama-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/auth/v1/user'
        ? { id: operator, email: 'operador@example.test' }
        : path.includes('rama_usuarios')
          ? authorized
            ? [
                {
                  id: operator,
                  nome: 'Equipe RAMA',
                  email: 'operador@example.test',
                  perfil: role,
                  ativo: true,
                },
              ]
            : []
          : path.includes('rama_pesquisar')
            ? [recipe]
            : path.includes('rama_receitas_historico')
              ? []
              : path.includes('rama_salvar')
                ? [recipe]
                : path.includes('rama_receitas')
                  ? recipe
                  : {};
    await route.fulfill({ json: data });
  });
}
test('Login sem cadastro público', async ({ page }) => {
  await page.goto('#/login');
  await expect(page.getByRole('button', { name: 'ENTRAR', exact: true })).toBeVisible();
  await expect(page.getByText('Criar conta', { exact: true })).toHaveCount(0);
});
test('Conta sem vínculo permanece bloqueada', async ({ page }) => {
  await mock(page, 'OPERADOR', false);
  await page.goto('#/consulta');
  await expect(page.getByRole('alert')).toContainText('não tem acesso ativo');
  await expect(page.getByRole('heading', { name: 'Receitas da RAMA', exact: true })).toHaveCount(0);
});
test('Operador bloqueado em URL administrativa e atualização de rota', async ({ page }) => {
  await mock(page);
  await page.goto('#/nova');
  await expect(page).toHaveURL(/#\/consulta/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Receitas da RAMA', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cadastrar receita' })).toHaveCount(0);
});
test('Pesquisa, detalhe sem foto e retorno preservado', async ({ page }) => {
  await mock(page);
  await page.goto('#/consulta');
  await page.getByRole('searchbox').fill('piquet');
  await expect(page).toHaveURL(/q=piquet/);
  await page.getByRole('link').filter({ hasText: 'IBI-REC-001' }).click();
  await expect(page.getByText('Pressão Fourlad', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  for (const product of ['Silicone', 'Graxo', 'Talco baby'])
    await expect(page.getByText(product, { exact: true })).toBeVisible();
  await expect(page.getByText('Sem foto disponível')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar receita / status' })).toHaveCount(0);
  await page.getByRole('link', { name: 'VOLTAR À PESQUISA' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('piquet');
});
for (const [name, width, height] of [
  ['celular', 390, 844],
  ['tablet', 820, 1180],
  ['desktop', 1440, 1000],
] as const) {
  test(`Consulta responsiva ${name}`, async ({ page }) => {
    await mock(page);
    await page.setViewportSize({ width, height });
    await page.goto('#/consulta');
    await expect(page.getByText(recipe.descricao)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/consulta-${name}.png`, fullPage: true });
    await page.getByRole('link').filter({ hasText: 'IBI-REC-001' }).click();
    await expect(page.getByText('Talco baby', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/receita-${name}.png`, fullPage: true });
  });
}
test('Supervisor: Fourlad, alimentação inteira e adicionar/editar/apagar itens do banho', async ({
  page,
}) => {
  await mock(page, 'SUPERVISOR');
  await page.goto('#/nova');
  await page.getByLabel('Descrição do artigo').fill(recipe.descricao);
  await page.getByLabel('Velocidade').fill('12,5');
  await page.getByLabel(/Temperatura/).fill('180');
  await page.getByLabel(/Pressão Fourlad/).fill('4,5');
  await page.getByLabel(/Largura/).fill('1,5');
  await page.getByLabel(/Alimentação/).fill('12');
  await expect(page.getByLabel(/Alimentação/)).toHaveAttribute('maxlength', '2');
  await page.getByLabel('Quantidade do item 1', { exact: true }).fill('40');
  await page.getByLabel('Produto do item 1', { exact: true }).fill('Silicone');
  await page.getByRole('button', { name: 'Adicionar item ao banho' }).click();
  await page.getByLabel('Quantidade do item 2', { exact: true }).fill('5');
  await page.getByLabel('Produto do item 2', { exact: true }).fill('Graxo');
  await page.getByRole('button', { name: 'Adicionar item ao banho' }).click();
  await page.getByLabel('Quantidade do item 3', { exact: true }).fill('50');
  await page.getByLabel('Produto do item 3', { exact: true }).fill('Talco baby');
  await page.getByLabel('Quantidade do item 2', { exact: true }).fill('7,5');
  await page.getByRole('button', { name: 'Apagar item 2 do banho', exact: true }).click();
  await expect(page.getByLabel('Produto do item 2', { exact: true })).toHaveValue('Talco baby');
  await page.screenshot({ path: 'test-results/cadastro-supervisor.png', fullPage: true });
  const sent = page.waitForRequest((r) => r.url().includes('/rpc/rama_salvar'));
  await page.getByRole('button', { name: 'SALVAR RECEITA' }).click();
  const body = (await sent).postDataJSON();
  expect(body.dados.largura).toBe(1.5);
  expect(body.dados.temperatura).toBe(180);
  expect(body.dados.alimentacao).toBe(12);
  expect(body.dados.pressao_fourlad).toBe(4.5);
  expect(body.dados.banho_itens).toEqual([
    { quantidade: 40, produto: 'Silicone' },
    { quantidade: 50, produto: 'Talco baby' },
  ]);
  await expect(page.getByRole('status')).toContainText('salva com sucesso');
});
test('Edição carrega todos os itens e preserva versão ao remover um produto', async ({ page }) => {
  await mock(page, 'SUPERVISOR');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`#/editar/${recipe.id}`);
  await expect(page.getByLabel(/Pressão Fourlad/)).toHaveValue('4,5');
  await expect(page.getByLabel(/Alimentação/)).toHaveValue('12');
  await expect(page.getByLabel('Produto do item 3', { exact: true })).toHaveValue('Talco baby');
  await page.getByRole('button', { name: 'Apagar item 1 do banho', exact: true }).click();
  await page.getByLabel('Quantidade do item 1', { exact: true }).fill('5,25');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/editar-celular.png', fullPage: true });
  const sent = page.waitForRequest((r) => r.url().includes('/rpc/rama_salvar'));
  await page.getByRole('button', { name: 'SALVAR RECEITA' }).click();
  const body = (await sent).postDataJSON();
  expect(body.versao_esperada).toBe(1);
  expect(body.dados.banho_itens).toEqual([
    { quantidade: 5.25, produto: 'Graxo' },
    { quantidade: 50, produto: 'Talco baby' },
  ]);
});
