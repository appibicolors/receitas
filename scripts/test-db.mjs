import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pg_trgm } });
let tests = 0;
const supervisor = '00000000-0000-0000-0000-000000000001',
  operator = '00000000-0000-0000-0000-000000000002',
  outsider = '00000000-0000-0000-0000-000000000003';
const recipe = '10000000-0000-0000-0000-000000000001';
const draft = {
  descricao: 'MALHA PIQUÉT ART. 245 AZUL MARINHO — POLO',
  foto: null,
  velocidade: 12.5,
  temperatura: 180,
  alimentacao: 12,
  pressao_fourlad: 4.5,
  banho_itens: [
    { quantidade: 40, produto: 'SILICONE' },
    { quantidade: 5, produto: 'GRAXO' },
    { quantidade: 50, produto: 'TALCO BABY' },
  ],
  largura: 1.5,
  observacao: 'Linha 1\nLinha 2',
  status: 'ATIVA',
};
async function role(id) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function ok(name, fn) {
  await fn();
  tests++;
  console.log(`PASS ${name}`);
}
async function denied(sql, args = []) {
  await assert.rejects(db.query(sql, args));
}
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create schema extensions;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated;
 create table public.apontamento_sentinel(id integer primary key,value text);insert into public.apontamento_sentinel values(1,'preservado');
 insert into auth.users values('${supervisor}'),('${operator}'),('${outsider}');`);
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261014162739_rama_receitas_core.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261014162756_rama_storage_privado.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261014163321_rama_pgtrgm_schema.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.query(
    'insert into rama_usuarios(id,nome,email,perfil) values($1,$2,$3,$4),($5,$6,$7,$8)',
    [
      supervisor,
      'Supervisor teste',
      'supervisor@example.test',
      'SUPERVISOR',
      operator,
      'Operador teste',
      'operador@example.test',
      'OPERADOR',
    ],
  );
  await role(supervisor);
  // Simula os dados antigos de teste antes da migration autorizada de limpeza.
  await db.query('select rama_salvar($1,$2,null)', [
    '90000000-0000-0000-0000-000000000001',
    { ...draft, alimentacao: 'A1-B2-03-04', banho: 3.25 },
  ]);
  await db.exec('reset role');
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/20261015131355_rama_fourlad_banho_itens_alimentacao.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await ok(
    'Limpeza remove somente receitas/histórico e reinicia código, preservando usuários',
    async () => {
      assert.equal((await db.query('select count(*) as n from rama_receitas')).rows[0].n, 0);
      assert.equal(
        (await db.query('select count(*) as n from rama_receitas_historico')).rows[0].n,
        0,
      );
      assert.equal((await db.query('select count(*) as n from rama_usuarios')).rows[0].n, 2);
      const seq = (await db.query('select last_value,is_called from rama_receitas_codigo_seq'))
        .rows[0];
      assert.equal(seq.last_value, 1);
      assert.equal(seq.is_called, false);
    },
  );
  await role(supervisor);
  let saved;
  await ok('Supervisor cria, código automático, decimais, descrição e foto opcional', async () => {
    saved = (await db.query('select * from rama_salvar($1,$2,null)', [recipe, draft])).rows[0];
    assert.equal(saved.codigo, 'IBI-REC-001');
    assert.equal(Number(saved.largura), 1.5);
    assert.equal(saved.foto, null);
    assert.equal(Number(saved.pressao_fourlad), 4.5);
    assert.equal(saved.alimentacao, 12);
    assert.deepEqual(saved.banho_itens, draft.banho_itens);
  });
  await db.exec('reset role');
  const snapshot = async () =>
    (
      await db.query(
        'select (select jsonb_agg(r order by id) from rama_receitas r) as receitas,(select jsonb_agg(h order by id) from rama_receitas_historico h) as historico,(select last_value from rama_receitas_codigo_seq) as sequencia',
      )
    ).rows[0];
  const beforeMigration = await snapshot();
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/20261015145516_rama_opcoes_na_caixa_alta.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await ok('Nova migration preserva receitas existentes, histórico e sequência', async () =>
    assert.deepEqual(await snapshot(), beforeMigration),
  );
  await role(supervisor);
  await ok('Temperatura decimal bloqueada no backend', () =>
    denied('select rama_salvar($1,$2,null)', [
      '10000000-0000-0000-0000-000000000002',
      { ...draft, temperatura: 180.5 },
    ]),
  );
  await ok('Pressão Fourlad rejeita negativos e infinito', async () => {
    for (const pressao_fourlad of [-1, 'Infinity', 'NaN'])
      await denied('select rama_salvar($1,$2,null)', [
        '30000000-0000-0000-0000-000000000003',
        { ...draft, pressao_fourlad },
      ]);
  });
  await ok('Alimentação rejeita 3 dígitos, decimais, negativos e letras', async () => {
    for (const alimentacao of [100, -1, 1.5, '01-02-03-04', 'AB', '001'])
      await denied('select rama_salvar($1,$2,null)', [
        '30000000-0000-0000-0000-000000000003',
        { ...draft, alimentacao },
      ]);
  });
  await ok('Itens de banho exigem quantidade numérica e produto preenchido', async () => {
    for (const banho_itens of [
      null,
      {},
      [null],
      [{ quantidade: 1, produto: ' ' }],
      [{ quantidade: '40', produto: 'SILICONE' }],
      [{ quantidade: -1, produto: 'GRAXO' }],
    ])
      await denied('select rama_salvar($1,$2,null)', [
        '30000000-0000-0000-0000-000000000003',
        { ...draft, banho_itens },
      ]);
  });
  await ok('Alimentação antiga bloqueada', () =>
    denied('select rama_salvar($1,$2,null)', [
      '10000000-0000-0000-0000-000000000002',
      { ...draft, alimentacao: 'A1-B2' },
    ]),
  );
  await ok('Largura zero e negativos bloqueados', async () => {
    await denied('select rama_salvar($1,$2,null)', [
      '10000000-0000-0000-0000-000000000002',
      { ...draft, largura: 0 },
    ]);
    await denied('select rama_salvar($1,$2,null)', [
      '10000000-0000-0000-0000-000000000002',
      { ...draft, banho_itens: [{ quantidade: -1, produto: 'SILICONE' }] },
    ]);
  });
  await ok('Imutabilidade e escrita direta bloqueadas', async () => {
    await denied("update rama_receitas set codigo='X'");
    await denied("update rama_receitas set descricao='X'");
    await denied('delete from rama_receitas');
  });
  await ok('Pesquisa por trechos, caixa e acentos', async () => {
    for (const term of ['piquet', '245', 'azul', 'MARINHO', 'polo', 'IBI-REC-001'])
      assert.equal((await db.query('select * from rama_pesquisar($1)', [term])).rows.length, 1);
  });
  await ok('Busca curta e caracteres curinga literais', async () => {
    assert.equal((await db.query("select * from rama_pesquisar('pi')")).rows.length, 0);
    assert.equal((await db.query("select * from rama_pesquisar('%%%')")).rows.length, 0);
  });
  await ok('Histórico imutável', async () => {
    assert.equal((await db.query('select * from rama_receitas_historico')).rows.length, 1);
    await denied('delete from rama_receitas_historico');
    await denied("update rama_receitas_historico set operacao='X'");
  });
  await role(operator);
  await ok('Operador lê somente receita ativa', async () =>
    assert.equal((await db.query('select * from rama_receitas')).rows.length, 1),
  );
  await ok('Operador não grava nem cria usuários', async () => {
    await denied('select rama_salvar($1,$2,1)', [recipe, draft]);
    await denied('select rama_excluir($1,1)', [recipe]);
    await denied('select rama_administrar_usuario($1,$2,$3,$4,$5,true)', [
      operator,
      operator,
      'X',
      'x@example.test',
      'SUPERVISOR',
    ]);
    await denied("update rama_usuarios set perfil='SUPERVISOR'");
  });
  await role(outsider);
  await ok('Conta Auth sem vínculo não lê receitas/fotos/perfil', async () => {
    for (const table of ['rama_receitas', 'rama_usuarios', 'storage.objects'])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
  });
  await role(supervisor);
  await db.query('select rama_salvar($1,$2,1)', [recipe, { ...draft, status: 'RASCUNHO' }]);
  await role(operator);
  await ok('Operador não lê rascunhos nem histórico', async () => {
    assert.equal((await db.query('select * from rama_receitas')).rows.length, 0);
    assert.equal((await db.query('select * from rama_receitas_historico')).rows.length, 0);
  });
  await role(supervisor);
  await db.query('select rama_salvar($1,$2,2)', [recipe, { ...draft, status: 'INATIVA' }]);
  await role(operator);
  await ok('Operador não lê inativas pela API de pesquisa', async () =>
    assert.equal((await db.query("select * from rama_pesquisar('PIQUET')")).rows.length, 0),
  );
  await role(supervisor);
  await ok('Versão antiga não sobrescreve edição', () =>
    denied('select rama_salvar($1,$2,1)', [recipe, draft]),
  );
  await db.query('select rama_excluir($1,3)', [recipe]);
  await ok('Exclusão oculta pesquisa, preserva histórico', async () => {
    assert.equal((await db.query('select * from rama_receitas')).rows.length, 0);
    assert.equal((await db.query('select * from rama_receitas_historico')).rows.length, 4);
  });
  await db.exec('reset role');
  await ok('Último supervisor protegido', () =>
    denied('select rama_administrar_usuario($1,$1,$2,$3,$4,false)', [
      supervisor,
      'Supervisor',
      's@example.test',
      'SUPERVISOR',
    ]),
  );
  await db.query('select rama_administrar_usuario($1,$2,$3,$4,$5,false)', [
    supervisor,
    operator,
    'Operador',
    'o@example.test',
    'OPERADOR',
  ]);
  await role(operator);
  await ok('Desativação somente módulo preserva conta Auth', async () => {
    assert.equal((await db.query('select rama_perfil() as p')).rows[0].p, null);
    await db.exec('reset role');
    assert.equal(
      (await db.query('select * from auth.users where id=$1', [operator])).rows.length,
      1,
    );
  });
  await role(supervisor);
  await ok('Códigos únicos em solicitações simultâneas e não reutilizados', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        db.query('select (rama_salvar($1,$2,null)).codigo as codigo', [
          `20000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
          draft,
        ]),
      ),
    );
    const codes = results.map((r) => r.rows[0].codigo);
    assert.equal(new Set(codes).size, 12);
    assert(!codes.includes('IBI-REC-001'));
  });
  await ok('Fotografia de outro ID não pode ser vinculada', () =>
    denied('select rama_salvar($1,$2,null)', [
      '30000000-0000-0000-0000-000000000001',
      {
        ...draft,
        foto: '40000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000002.webp',
      },
    ]),
  );
  await db.exec('reset role');
  await ok('Storage só permite foto de receita ativa a operador autorizado', async () => {
    await db.query('select rama_administrar_usuario($1,$2,$3,$4,$5,true)', [
      supervisor,
      operator,
      'Operador',
      'o@example.test',
      'OPERADOR',
    ]);
    const photoId = '20000000-0000-0000-0000-000000000001';
    const path = `${photoId}/50000000-0000-0000-0000-000000000001.webp`;
    await role(supervisor);
    await db.query('select rama_salvar($1,$2,1)', [photoId, { ...draft, foto: path }]);
    await db.exec('reset role');
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [
      'rama-fotos',
      path,
    ]);
    await role(operator);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await role(outsider);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await role(supervisor);
    await db.query('select rama_salvar($1,$2,2)', [
      photoId,
      { ...draft, foto: path, status: 'INATIVA' },
    ]);
    await role(operator);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await db.exec('reset role');
  });
  await ok('Objeto preexistente preservado no banco isolado', async () =>
    assert.equal(
      (await db.query('select value from apontamento_sentinel')).rows[0].value,
      'preservado',
    ),
  );
  await role(supervisor);
  await ok('Itens de banho são editáveis/removíveis e auditados com pressão Fourlad', async () => {
    const id = '60000000-0000-0000-0000-000000000001';
    await db.query('select rama_salvar($1,$2,null)', [id, draft]);
    const banho_itens = [
      { quantidade: 40, produto: 'SILICONE' },
      { quantidade: 5.25, produto: 'GRAXO' },
    ];
    await db.query('select rama_salvar($1,$2,1)', [
      id,
      { ...draft, pressao_fourlad: 6.5, banho_itens },
    ]);
    const row = (await db.query('select * from rama_receitas where id=$1', [id])).rows[0];
    assert.deepEqual(row.banho_itens, banho_itens);
    assert.equal(Number(row.pressao_fourlad), 6.5);
    const h = (
      await db.query(
        'select * from rama_receitas_historico where receita_id=$1 order by id desc limit 1',
        [id],
      )
    ).rows[0];
    assert.deepEqual(h.dados_anteriores.banho_itens, draft.banho_itens);
    assert.deepEqual(h.dados_novos.banho_itens, banho_itens);
    assert.equal(Number(h.dados_novos.pressao_fourlad), 6.5);
  });
  await ok('SEM BANHO e NÃO APLICÁVEL independentes, caixa alta e histórico', async () => {
    const id = '70000000-0000-0000-0000-000000000001';
    const row = (
      await db.query('select * from rama_salvar($1,$2,null)', [
        id,
        {
          ...draft,
          descricao: 'malha térmica',
          observacao: 'ação\nsegunda linha',
          banho_itens: [],
          largura: null,
          pressao_fourlad: null,
        },
      ])
    ).rows[0];
    assert.deepEqual(row.banho_itens, []);
    assert.equal(row.largura, null);
    assert.equal(row.pressao_fourlad, null);
    assert.equal(row.descricao, 'MALHA TÉRMICA');
    assert.equal(row.observacao, 'AÇÃO\nSEGUNDA LINHA');
    const normal = (
      await db.query('select * from rama_salvar($1,$2,1)', [
        id,
        { ...draft, banho_itens: [{ quantidade: 5, produto: 'óleo graxo' }], largura: null },
      ])
    ).rows[0];
    assert.deepEqual(normal.banho_itens, [{ quantidade: 5, produto: 'ÓLEO GRAXO' }]);
    assert.equal(normal.largura, null);
    assert.equal(Number(normal.pressao_fourlad), 4.5);
    const h = (
      await db.query(
        'select * from rama_receitas_historico where receita_id=$1 order by id desc limit 1',
        [id],
      )
    ).rows[0];
    assert.deepEqual(h.dados_anteriores.banho_itens, []);
    assert.equal(h.dados_anteriores.pressao_fourlad, null);
  });
  console.log(
    `${tests} testes PostgreSQL aprovados. Auth/Storage reais não simulados como produção.`,
  );
} catch (e) {
  console.error('FAIL', e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
