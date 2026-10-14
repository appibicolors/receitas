import { useEffect, useState, type FormEvent } from 'react';
import { supabase, fail } from '../lib/client';
import { type Profile } from '../lib/domain';
import { Alert, Badge, Spinner } from '../components';
export default function UsersPage() {
  const [rows, setRows] = useState<Profile[]>([]),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [mode, setMode] = useState('invite'),
    [nome, setNome] = useState(''),
    [email, setEmail] = useState(''),
    [id, setId] = useState(''),
    [perfil, setPerfil] = useState('OPERADOR');
  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('rama_usuarios')
      .select('id,nome,email,perfil,ativo')
      .order('data_criacao', { ascending: false })
      .range(page * 20, page * 20 + 19);
    setRows(data ?? []);
    setError(error?.message ?? '');
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [page]);
  async function invoke(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('rama-admin', { body });
    fail(error);
    if (data.error) throw Error(data.error);
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await invoke({ action: mode, nome, email, id, perfil, ativo: true });
      setSuccess(
        mode === 'invite'
          ? 'Convite enviado. O usuário deverá definir sua senha.'
          : 'Conta existente vinculada ao módulo RAMA.',
      );
      setNome('');
      setEmail('');
      setId('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(r: Profile, patch: Partial<Profile>) {
    if (!window.confirm(`Confirmar alteração do acesso RAMA de ${r.nome}?`)) return;
    setBusy(true);
    setError('');
    try {
      await invoke({ action: 'update', ...r, ...patch });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACESSO AO MÓDULO</span>
          <h1>Gerenciar usuários</h1>
          <p>Convites individuais e permissões exclusivas da RAMA.</p>
        </div>
      </div>
      <Alert>{error}</Alert>
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      <section className="panel">
        <h2>Adicionar acesso</h2>
        <form onSubmit={create}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Forma de inclusão
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="invite">Convidar nova conta por e-mail</option>
                  <option value="link">Vincular conta Auth existente</option>
                </select>
              </label>
              <label>
                Nome
                <input
                  required
                  maxLength={200}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
              {mode === 'invite' ? (
                <label>
                  E-mail
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              ) : (
                <label>
                  UUID autorizado do Supabase Auth
                  <input required value={id} onChange={(e) => setId(e.target.value)} />
                </label>
              )}
              <label>
                Perfil
                <select value={perfil} onChange={(e) => setPerfil(e.target.value)}>
                  <option>OPERADOR</option>
                  <option>SUPERVISOR</option>
                </select>
              </label>
            </div>
            <button className="primary" disabled={busy}>
              {busy ? 'Processando…' : mode === 'invite' ? 'ENVIAR CONVITE' : 'VINCULAR CONTA'}
            </button>
          </fieldset>
        </form>
      </section>
      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>Nome / e-mail</th>
                <th>Perfil</th>
                <th>Acesso RAMA</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.nome}</strong>
                    <small>{r.email}</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Perfil de ${r.nome}`}
                      value={r.perfil}
                      disabled={busy}
                      onChange={(e) =>
                        void update(r, { perfil: e.target.value as Profile['perfil'] })
                      }
                    >
                      <option>OPERADOR</option>
                      <option>SUPERVISOR</option>
                    </select>
                  </td>
                  <td>
                    <Badge status={r.ativo ? 'ATIVA' : 'INATIVA'} />
                  </td>
                  <td>
                    <button disabled={busy} onClick={() => void update(r, { ativo: !r.ativo })}>
                      {r.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>Nenhum usuário nesta página.</p>}
        </div>
      )}
      <div className="pagination">
        <button disabled={!page || loading} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button disabled={rows.length < 20 || loading} onClick={() => setPage(page + 1)}>
          Próxima
        </button>
      </div>
    </>
  );
}
