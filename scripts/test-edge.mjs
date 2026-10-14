// Executa o código real da função com adaptadores Supabase/Deno simulados.
// Não acessa rede nem verifica Auth/Storage de produção.
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
const actor = '00000000-0000-0000-0000-000000000001';
const target = '00000000-0000-0000-0000-000000000002';
let handler,
  profile = { perfil: 'SUPERVISOR', ativo: true },
  invalidSession = false,
  referenced = false;
const calls = [];
const admin = {
  auth: {
    getUser: async () =>
      invalidSession
        ? { data: { user: null }, error: { message: 'invalid' } }
        : { data: { user: { id: actor } }, error: null },
    admin: {
      inviteUserByEmail: async (email, options) => {
        calls.push({ type: 'invite', email, options });
        return { data: { user: { id: target, email } }, error: null };
      },
      getUserById: async (id) => ({
        data: { user: { id, email: 'existing@example.test' } },
        error: null,
      }),
    },
  },
  from(table) {
    const query = {
      select: () => query,
      eq: () => query,
      or: () => query,
      limit: () => query,
      single: async () => ({ data: table === 'rama_usuarios' ? profile : null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then(resolve, reject) {
        return Promise.resolve({
          data: table === 'rama_receitas_historico' ? [] : null,
          count: referenced ? 1 : 0,
          error: null,
        }).then(resolve, reject);
      },
    };
    return query;
  },
  rpc: async (name, args) => {
    calls.push({ type: 'rpc', name, args });
    return { error: null };
  },
  storage: {
    from: () => ({
      upload: async (path, bytes, options) => {
        calls.push({ type: 'upload', path, bytes, options });
        return { error: null };
      },
      remove: async (paths) => {
        calls.push({ type: 'remove', paths });
        return { error: null };
      },
    }),
  },
};
globalThis.__ramaAdminTestClient = admin;
globalThis.Deno = {
  env: {
    get: (name) =>
      ({
        SUPABASE_URL: 'https://mock.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only',
        RAMA_APP_ORIGIN: 'https://app.example.test',
        RAMA_INVITE_REDIRECT: 'https://app.example.test/receitas/convite.html',
      })[name],
  },
  serve: (fn) => {
    handler = fn;
  },
};
const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const rules = transpile(
  await readFile(new URL('../supabase/functions/rama-admin/rules.ts', import.meta.url), 'utf8'),
);
const code = transpile(
  await readFile(new URL('../supabase/functions/rama-admin/index.ts', import.meta.url), 'utf8'),
)
  .replace(
    /import\s*\{\s*createClient\s*\}\s*from\s*['"]npm:[^'"]+['"];?/,
    'const createClient=()=>globalThis.__ramaAdminTestClient;',
  )
  .replace(/import\s*\{\s*validWebp\s*\}\s*from\s*['"][^'"]+['"];?/, '');
await import(`data:text/javascript;base64,${Buffer.from(rules + '\n' + code).toString('base64')}`);
let tests = 0;
async function test(name, fn) {
  calls.length = 0;
  profile = { perfil: 'SUPERVISOR', ativo: true };
  invalidSession = false;
  referenced = false;
  await fn();
  tests++;
  console.log(`PASS ${name}`);
}
function request(body, token = true, origin = 'https://app.example.test') {
  return new Request('https://mock.test/functions/v1/rama-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(token ? { Authorization: 'Bearer test-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}
const input = {
  action: 'invite',
  nome: 'Nome teste',
  email: 'invite@example.test',
  perfil: 'OPERADOR',
  ativo: true,
};
async function blocked(req, status) {
  assert.equal((await handler(req)).status, status);
  assert.equal(calls.length, 0);
}
try {
  await test('Sem sessão não executa administração', () => blocked(request(input, false), 401));
  await test('Token inválido bloqueado', async () => {
    invalidSession = true;
    await blocked(request(input), 401);
  });
  await test('Operador não convida usuários', async () => {
    profile = { perfil: 'OPERADOR', ativo: true };
    await blocked(request(input), 403);
  });
  await test('Supervisor inativo bloqueado', async () => {
    profile = { perfil: 'SUPERVISOR', ativo: false };
    await blocked(request(input), 403);
  });
  await test('Conta sem vínculo bloqueada', async () => {
    profile = null;
    await blocked(request(input), 403);
  });
  await test('Origem diferente bloqueada', () =>
    blocked(request(input, true, 'https://evil.example.test'), 403));
  await test('Perfil arbitrário rejeitado', () =>
    blocked(request({ ...input, perfil: 'ADMIN' }), 400));
  await test('Convite de supervisor autorizado passa ator verificado à RPC', async () => {
    const response = await handler(request(input));
    assert.equal(response.status, 200);
    assert.equal(calls[0].type, 'invite');
    assert.equal(calls[0].options.redirectTo, 'https://app.example.test/receitas/convite.html');
    assert.equal(calls[1].args.ator, actor);
    assert.equal(calls[1].args.alvo, target);
  });
  await test('Vínculo reutiliza Auth sem modificar credenciais', async () => {
    assert.equal((await handler(request({ ...input, action: 'link', id: target }))).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'rpc');
  });
  await test('Upload falsificado bloqueado antes de Storage', async () => {
    const body = new FormData();
    body.set('action', 'photo');
    body.set('recipeId', target);
    body.set('file', new Blob(['fake'], { type: 'image/webp' }), 'foto.webp');
    await blocked(
      new Request('https://mock.test', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body,
      }),
      400,
    );
  });
  await test('Upload WebP válido usa caminho exclusivo e não sobrescreve', async () => {
    const bytes = Uint8Array.from(
      atob('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'),
      (c) => c.charCodeAt(0),
    );
    const body = new FormData();
    body.set('action', 'photo');
    body.set('recipeId', target);
    body.set('file', new Blob([bytes], { type: 'image/webp' }), 'foto.webp');
    assert.equal(
      (
        await handler(
          new Request('https://mock.test', {
            method: 'POST',
            headers: { Authorization: 'Bearer test-token' },
            body,
          }),
        )
      ).status,
      200,
    );
    assert.equal(calls[0].type, 'upload');
    assert(calls[0].path.startsWith(target + '/'));
    assert.equal(calls[0].options.upsert, false);
  });
  await test('Foto referenciada não é apagada', async () => {
    referenced = true;
    await blocked(request({ action: 'discardPhoto', path: `${target}/${actor}.webp` }), 409);
  });
  console.log(
    `${tests} testes Edge com adaptadores simulados aprovados; integração real pendente.`,
  );
} catch (e) {
  console.error('FAIL', e.message);
  process.exitCode = 1;
} finally {
  delete globalThis.Deno;
  delete globalThis.__ramaAdminTestClient;
}
