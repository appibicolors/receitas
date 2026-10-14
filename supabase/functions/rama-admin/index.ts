import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { validWebp } from './rules.ts';
const url = Deno.env.get('SUPABASE_URL')!,
  key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const origin = Deno.env.get('RAMA_APP_ORIGIN') ?? 'https://appibicolors.github.io';
const redirect =
  Deno.env.get('RAMA_INVITE_REDIRECT') ?? 'https://appibicolors.github.io/receitas/convite.html';
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async (req) => {
  if (!origin || !redirect) return json({ error: 'Configuração administrativa incompleta.' }, 503);
  if (req.headers.get('Origin') && req.headers.get('Origin') !== origin)
    return json({ error: 'Origem não autorizada.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sessão necessária.' }, 401);
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sessão expirada.' }, 401);
    const { data: actor, error: profileError } = await admin
      .from('rama_usuarios')
      .select('perfil,ativo')
      .eq('id', user.id)
      .single();
    if (profileError || actor?.perfil !== 'SUPERVISOR' || !actor.ativo)
      return json({ error: 'Supervisor autorizado necessário.' }, 403);
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      if (Number(req.headers.get('content-length') ?? 0) > 2200000)
        return json({ error: 'Arquivo muito grande.' }, 413);
      const form = await req.formData(),
        file = form.get('file'),
        recipeId = form.get('recipeId');
      if (
        form.get('action') !== 'photo' ||
        !uuid(recipeId) ||
        !(file instanceof File) ||
        file.size > 2097152 ||
        file.type !== 'image/webp'
      )
        return json({ error: 'Foto inválida.' }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validWebp(bytes)) return json({ error: 'Conteúdo WebP inválido.' }, 400);
      const { data: existing, error: recipeError } = await admin
        .from('rama_receitas')
        .select('data_exclusao')
        .eq('id', recipeId)
        .maybeSingle();
      if (recipeError) throw recipeError;
      if (existing?.data_exclusao) return json({ error: 'Receita excluída.' }, 409);
      const path = `${recipeId}/${crypto.randomUUID()}.webp`;
      const { error } = await admin.storage
        .from('rama-fotos')
        .upload(path, bytes, { contentType: 'image/webp', upsert: false });
      if (error) throw error;
      return json({ path });
    }
    const body = await req.json();
    if (body.action === 'discardPhoto') {
      if (
        typeof body.path !== 'string' ||
        !/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.webp$/.test(body.path)
      )
        return json({ error: 'Caminho inválido.' }, 400);
      const [referencesResult, historyResult] = await Promise.all([
        admin
          .from('rama_receitas')
          .select('id', { count: 'exact', head: true })
          .eq('foto', body.path),
        admin
          .from('rama_receitas_historico')
          .select('id')
          .or(`dados_novos->>foto.eq.${body.path},dados_anteriores->>foto.eq.${body.path}`)
          .limit(1),
      ]);
      if (referencesResult.error || historyResult.error)
        throw Error('Falha ao verificar referências');
      if (referencesResult.count || historyResult.data?.length)
        return json({ error: 'Foto preservada por receita ou histórico.' }, 409);
      const { error } = await admin.storage.from('rama-fotos').remove([body.path]);
      if (error) throw error;
      return json({ ok: true });
    }
    if (!['invite', 'update', 'link'].includes(body.action))
      return json({ error: 'Operação inválida.' }, 400);
    if (
      typeof body.nome !== 'string' ||
      !body.nome.trim() ||
      body.nome.length > 200 ||
      !['SUPERVISOR', 'OPERADOR'].includes(body.perfil) ||
      typeof body.ativo !== 'boolean'
    )
      return json({ error: 'Dados inválidos.' }, 400);
    let target: string, email: string;
    if (body.action === 'update') {
      if (!uuid(body.id)) return json({ error: 'ID inválido.' }, 400);
      const { data: existing, error } = await admin
        .from('rama_usuarios')
        .select('id,email')
        .eq('id', body.id)
        .single();
      if (error) throw error;
      target = existing.id;
      email = existing.email;
    } else if (body.action === 'link') {
      if (!uuid(body.id)) return json({ error: 'Informe o UUID Auth autorizado.' }, 400);
      const { data, error } = await admin.auth.admin.getUserById(body.id);
      if (error || !data.user?.email) return json({ error: 'Usuário Auth não localizado.' }, 400);
      target = data.user.id;
      email = data.user.email;
      // Reutiliza a conta existente sem trocar senha ou metadados.
    } else {
      if (
        typeof body.email !== 'string' ||
        body.email.length > 254 ||
        !/^\S+@\S+\.\S+$/.test(body.email)
      )
        return json({ error: 'E-mail inválido.' }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email.trim(), {
        redirectTo: redirect,
      });
      if (error || !data.user)
        return json(
          {
            error:
              'Convite não enviado. Verifique SMTP ou vincule uma conta Auth existente por UUID.',
          },
          400,
        );
      target = data.user.id;
      email = data.user.email!;
    }
    const { error } = await admin.rpc('rama_administrar_usuario', {
      ator: user.id,
      alvo: target,
      nome: body.nome.trim(),
      email,
      perfil: body.perfil,
      ativo: body.ativo,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, id: target });
  } catch {
    // Sem tokens, senhas, detalhes de contas ou payloads em logs.
    return json(
      { error: 'Operação não concluída. Verifique a configuração e tente novamente.' },
      400,
    );
  }
});
