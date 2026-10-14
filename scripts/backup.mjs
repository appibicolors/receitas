// Somente exportação. Credenciais entram via ambiente seguro, nunca argumentos.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente administrativo.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const output = resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(join(output, 'fotos'), { recursive: true });
const manifest = {
  createdAt: new Date().toISOString(),
  module: 'RAMA',
  consistency: 'Exportar somente em janela sem escritas RAMA; conferir sequência separadamente.',
  tables: {},
  files: [],
};
async function save(name, content) {
  const bytes = typeof content === 'string' ? Buffer.from(content) : content;
  await writeFile(join(output, name), bytes);
  manifest.files.push({
    path: name,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const paths = new Set();
try {
  for (const table of ['rama_usuarios', 'rama_receitas', 'rama_receitas_historico']) {
    const rows = [];
    let after = null;
    while (true) {
      let query = client.from(table).select('*').order('id').limit(500);
      if (after !== null) query = query.gt('id', after);
      const { data, error } = await query;
      if (error) throw Error(`Falha ao exportar ${table}.`);
      rows.push(...data);
      if (data.length < 500) break;
      after = data.at(-1).id;
    }
    manifest.tables[table] = rows.length;
    await save(`${table}.json`, JSON.stringify(rows, null, 2));
    for (const row of rows) {
      for (const p of [row.foto, row.dados_anteriores?.foto, row.dados_novos?.foto])
        if (p) paths.add(p);
    }
  }
  for (const path of paths) {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path))
      throw Error('Caminho de foto inesperado; exportação interrompida.');
    const { data, error } = await client.storage.from('rama-fotos').download(path);
    if (error) throw Error('Falha ao exportar foto referenciada.');
    await mkdir(join(output, 'fotos', path.split('/')[0]), { recursive: true });
    await save(`fotos/${path}`, Buffer.from(await data.arrayBuffer()));
  }
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `Exportação RAMA concluída em ${output}. Verifique sequência, consistência e restauração antes de considerá-la backup válido.`,
  );
} catch (e) {
  console.error(e.message, 'Exportação incompleta: não usar para restauração.');
  process.exitCode = 1;
}
