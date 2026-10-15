import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, Plus, Edit, History, Trash2 } from 'lucide-react';
import { supabase, fail } from '../lib/client';
import { type Summary, type Recipe, type Status, dateBR, numberBR } from '../lib/domain';
import { Alert, Photo, Badge, Spinner } from '../components';
import { useAuth } from '../auth';
function historyValue(value: unknown, key = ''): string {
  if (value === null && ['largura', 'pressao_fourlad'].includes(key)) return 'NÃO APLICÁVEL';
  if (key === 'banho_itens' && Array.isArray(value) && !value.length) return 'SEM BANHO';
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value))
    return value
      .map((item) =>
        item && typeof item === 'object' && 'quantidade' in item && 'produto' in item
          ? `${numberBR(Number(item.quantidade))} g/L ${item.produto}`
          : JSON.stringify(item),
      )
      .join('\n');
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}
export function SearchPage({ manage = false }: { manage?: boolean }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '',
    page = Number(params.get('page') ?? 0) || 0,
    status = params.get('status') ?? '',
    order = params.get('order') ?? 'atualizacao';
  const [term, setTerm] = useState(q),
    [rows, setRows] = useState<Summary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    setTerm(q);
  }, [q]);
  const location = useLocation();
  useEffect(() => {
    if (!loading && location.state?.restoreScroll !== undefined)
      window.scrollTo(0, location.state.restoreScroll);
  }, [loading, location.state]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q) {
        const p = new URLSearchParams(params);
        p.set('q', term);
        p.delete('page');
        setParams(p, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term, q, params, setParams]);
  useEffect(() => {
    const ticket = ++sequence.current;
    setLoading(true);
    setError('');
    void supabase
      .rpc('rama_pesquisar', {
        termo: q,
        situacao: manage ? status || null : 'ATIVA',
        pagina: page,
        ordem: order,
      })
      .then(({ data, error }) => {
        if (ticket !== sequence.current) return;
        setLoading(false);
        if (error) {
          setError(error.message);
          setRows([]);
        } else setRows(data ?? []);
      });
    return () => {
      sequence.current++;
    };
  }, [q, page, status, order, manage]);
  function filter(key: string, value: string) {
    const p = new URLSearchParams(params);
    p.set(key, value);
    if (key !== 'page') p.delete('page');
    setParams(p);
  }
  async function remove(r: Summary) {
    if (!window.confirm(`Excluir ${r.codigo}? A receita será ocultada e o histórico preservado.`))
      return;
    try {
      const { error } = await supabase.rpc('rama_excluir', {
        receita_id: r.id,
        versao_esperada: r.versao,
      });
      fail(error);
      setRows(rows.filter((x) => x.id !== r.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const back = `${manage ? '/gerenciar' : '/consulta'}?${params.toString()}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{manage ? 'ADMINISTRAÇÃO' : 'CONSULTA OPERACIONAL'}</span>
          <h1>{manage ? 'Gerenciar receitas' : 'Receitas da RAMA'}</h1>
          <p>
            {manage
              ? 'Mantenha os processos atualizados e acompanhe as versões.'
              : 'Encontre o artigo e consulte os parâmetros do processo.'}
          </p>
        </div>
        {manage && (
          <Link className="button primary" to="/nova">
            <Plus size={18} />
            Nova receita
          </Link>
        )}
      </div>
      <section className="panel search-panel">
        <label className="search-label" htmlFor="search">
          Pesquisar por descrição ou código
        </label>
        <div className="search-input">
          <Search size={22} />
          <input
            id="search"
            type="search"
            placeholder="Ex.: piquet, azul marinho, 245 ou IBI-REC-001"
            maxLength={500}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="filters">
          {manage && (
            <label>
              Status
              <select value={status} onChange={(e) => filter('status', e.target.value)}>
                <option value="">Todos</option>
                {(['ATIVA', 'RASCUNHO', 'INATIVA'] as Status[]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Ordenar
            <select value={order} onChange={(e) => filter('order', e.target.value)}>
              <option value="atualizacao">Mais recentes</option>
              <option value="codigo">Código</option>
              <option value="descricao">Descrição</option>
            </select>
          </label>
          <small>Digite pelo menos 3 caracteres para pesquisar.</small>
        </div>
      </section>
      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : rows.length ? (
        <div className="results">
          {rows.map((r) => (
            <article className="result" key={r.id}>
              <Link
                className="recipe-link"
                to={`/receita/${r.id}`}
                state={{ back, scroll: window.scrollY }}
              >
                <Photo path={r.foto} />
                <div>
                  <span className="recipe-code">{r.codigo}</span>
                  <h2>{r.descricao}</h2>
                  {manage && <small>Atualizada em {dateBR(r.data_atualizacao)}</small>}
                </div>
                <Badge status={r.status} />
                <ArrowRight size={18} />
              </Link>
              {manage && (
                <div className="row-actions">
                  <Link className="button" to={`/editar/${r.id}`}>
                    <Edit size={16} />
                    Editar / status
                  </Link>
                  <Link className="button" to={`/historico/${r.id}`}>
                    <History size={16} />
                    Histórico
                  </Link>
                  <button className="danger" onClick={() => void remove(r)}>
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Search size={32} />
          <h2>
            {q.trim().length > 0 && q.trim().length < 3
              ? 'Continue digitando'
              : 'Nenhuma receita encontrada'}
          </h2>
          <p>
            {q.trim().length < 3 && q
              ? 'Use ao menos 3 caracteres.'
              : 'Experimente outro trecho da descrição ou código.'}
          </p>
        </div>
      )}
      <div className="pagination">
        <button disabled={page === 0 || loading} onClick={() => filter('page', String(page - 1))}>
          <ArrowLeft size={16} />
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          disabled={rows.length < 20 || loading}
          onClick={() => filter('page', String(page + 1))}
        >
          Próxima
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
import { useLocation } from 'react-router-dom';
export function Detail() {
  const { id } = useParams();
  const location = useLocation();
  const { profile } = useAuth();
  const [r, setR] = useState<Recipe | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void supabase
      .from('rama_receitas')
      .select(
        'id,codigo,descricao,foto,status,data_atualizacao,versao,velocidade,temperatura,alimentacao,pressao_fourlad,banho_itens,largura,observacao,data_criacao,criado_por,atualizado_por',
      )
      .eq('id', id!)
      .single()
      .then(({ data, error }) => {
        if (active) {
          setR(data);
          if (error) setError('Receita indisponível ou acesso não autorizado.');
        }
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (error) return <Alert>{error}</Alert>;
  if (!r) return <Spinner />;
  const back = location.state?.back ?? '/consulta';
  return (
    <>
      {location.state?.saved && (
        <div className="success" role="status">
          Receita {location.state.saved} salva com sucesso.
        </div>
      )}
      <Link className="back" to={back} state={{ restoreScroll: location.state?.scroll }}>
        <ArrowLeft size={18} />
        VOLTAR À PESQUISA
      </Link>
      <div className="page-heading">
        <div>
          <span className="recipe-code">{r.codigo}</span>
          <h1>{r.descricao}</h1>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="detail-grid">
        <Photo path={r.foto} large />
        <section className="panel">
          <span className="eyebrow">PARÂMETROS DA RAMA</span>
          <div className="parameters">
            {[
              ['Velocidade', numberBR(r.velocidade), 'm/min'],
              ['Temperatura', numberBR(r.temperatura), '°C'],
              [
                'Pressão Fourlad',
                r.pressao_fourlad === null ? 'NÃO APLICÁVEL' : numberBR(r.pressao_fourlad),
                r.pressao_fourlad === null ? '' : 'kgf/cm²',
              ],
              ['Alimentação', String(r.alimentacao), ''],
              [
                'Largura',
                r.largura === null ? 'NÃO APLICÁVEL' : numberBR(r.largura),
                r.largura === null ? '' : 'm',
              ],
            ].map(([label, value, unit]) => (
              <div key={label}>
                <span>{label}</span>
                <strong className={value === 'NÃO APLICÁVEL' ? 'not-applicable' : undefined}>
                  {value} <small>{unit}</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel bath-detail">
        <h2>Composição do banho</h2>
        {!r.banho_itens.length && <p className="bath-condition">SEM BANHO</p>}
        <ul className="bath-list">
          {r.banho_itens.map((item, index) => (
            <li key={index}>
              <strong>
                {numberBR(item.quantidade)} <small>g/L</small>
              </strong>
              <span>{item.produto}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel observations">
        <h2>Orientações e observações</h2>
        <p>{r.observacao || 'Nenhuma observação informada.'}</p>
      </section>
      <div className="detail-footer">
        <small>
          Atualizada em {dateBR(r.data_atualizacao)} · Versão {r.versao}
        </small>
        {profile?.perfil === 'SUPERVISOR' && (
          <Link className="button" to={`/editar/${r.id}`}>
            <Edit size={18} />
            Editar receita / status
          </Link>
        )}
      </div>
    </>
  );
}
export function Dashboard() {
  const [counts, setCounts] = useState<number[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void Promise.all(
      ['ATIVA', 'RASCUNHO', 'INATIVA']
        .map((status) =>
          supabase
            .from('rama_receitas')
            .select('id', { count: 'exact', head: true })
            .eq('status', status),
        )
        .concat([
          supabase
            .from('rama_usuarios')
            .select('id', { count: 'exact', head: true })
            .eq('ativo', true),
        ]),
    ).then((results) => {
      const e = results.find((r) => r.error)?.error;
      if (e) setError(e.message);
      else setCounts(results.map((r) => r.count ?? 0));
    });
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUPERVISÃO</span>
          <h1>Controle das receitas</h1>
          <p>Uma base organizada para cada etapa do acabamento.</p>
        </div>
        <Link className="button primary" to="/nova">
          <Plus size={18} />
          Cadastrar receita
        </Link>
      </div>
      <Alert>{error}</Alert>
      {!counts ? (
        <Spinner />
      ) : (
        <div className="stats">
          {['Receitas ativas', 'Rascunhos', 'Receitas inativas', 'Usuários ativos'].map(
            (label, i) => (
              <Link
                to={
                  i === 3 ? '/usuarios' : `/gerenciar?status=${['ATIVA', 'RASCUNHO', 'INATIVA'][i]}`
                }
                className="panel"
                key={label}
              >
                <span>{label}</span>
                <strong>{counts[i]}</strong>
                <small>
                  Ver registros <ArrowRight size={14} />
                </small>
              </Link>
            ),
          )}
        </div>
      )}
      <section className="panel welcome">
        <h2>Informação clara para a operação</h2>
        <p>
          Revise os parâmetros e publique a receita como ATIVA para disponibilizá-la aos operadores.
          Rascunhos e receitas inativas ficam restritos à supervisão.
        </p>
        <Link className="button" to="/gerenciar">
          Gerenciar receitas
          <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
type Entry = {
  id: number;
  receita_id: string;
  operacao: string;
  usuario_id: string;
  data: string;
  versao: number;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown>;
};
export function HistoryPage() {
  const { id } = useParams();
  const [page, setPage] = useState(0),
    [rows, setRows] = useState<Entry[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from('rama_receitas_historico')
      .select('id,receita_id,operacao,usuario_id,data,versao,dados_anteriores,dados_novos')
      .order('id', { ascending: false })
      .range(page * 20, page * 20 + 19);
    if (id) query = query.eq('receita_id', id);
    void query.then(({ data, error }) => {
      setLoading(false);
      setRows(data ?? []);
      setError(error?.message ?? '');
    });
  }, [id, page]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RASTREABILIDADE</span>
          <h1>Histórico de alterações</h1>
          <p>Registros gerados pelo banco, preservados após exclusão.</p>
        </div>
      </div>
      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : (
        rows.map((r) => (
          <details className="panel history-entry" key={r.id}>
            <summary>
              <strong>
                {String(r.dados_novos.codigo)} · {r.operacao}
              </strong>
              <span>
                {dateBR(r.data)} · Versão {r.versao}
              </span>
            </summary>
            <p>Responsável (UUID Auth): {r.usuario_id}</p>
            <div className="history-diff">
              {Object.entries(r.dados_novos)
                .filter(
                  ([k, v]) =>
                    !['busca', 'data_atualizacao', 'atualizado_por', 'versao'].includes(k) &&
                    JSON.stringify(r.dados_anteriores?.[k]) !== JSON.stringify(v),
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}</strong>
                    <span>Anterior: {historyValue(r.dados_anteriores?.[k], k)}</span>
                    <span>Novo: {historyValue(v, k)}</span>
                  </div>
                ))}
            </div>
          </details>
        ))
      )}
      {!loading && !rows.length && <p className="empty">Nenhum registro.</p>}
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
