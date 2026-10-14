import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Upload } from 'lucide-react';
import { supabase, fail } from '../lib/client';
import {
  emptyDraft,
  maskFeed,
  toDraft,
  validate,
  type Draft,
  type Recipe,
  type Status,
} from '../lib/domain';
import { uploadPhoto, discardPhoto } from '../lib/photos';
import { Alert, Photo, Spinner } from '../components';
export default function Editor() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [recipeId] = useState(() => id ?? crypto.randomUUID());
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft }),
    [version, setVersion] = useState<number | null>(null),
    [code, setCode] = useState('Gerado automaticamente ao salvar'),
    [loading, setLoading] = useState(Boolean(id)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (!id) return;
    void supabase
      .from('rama_receitas')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) setError('Receita indisponível.');
        else {
          setDraft(toDraft(data as Recipe));
          setVersion(data.versao);
          setCode(data.codigo);
        }
      });
  }, [id]);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    let uploaded: string | null = null;
    try {
      const data = validate(draft);
      if (file) {
        uploaded = await uploadPhoto(recipeId, file);
        data.foto = uploaded;
      }
      const { data: saved, error } = await supabase.rpc('rama_salvar', {
        receita_id: recipeId,
        dados: data,
        versao_esperada: version,
      });
      fail(error);
      const record = Array.isArray(saved) ? saved[0] : saved;
      navigate(`/receita/${recipeId}`, { replace: true, state: { saved: record?.codigo } });
    } catch (e) {
      if (uploaded) {
        try {
          await discardPhoto(uploaded);
        } catch {
          setError('Uma foto não vinculada aguarda limpeza administrativa. ');
        }
      }
      setError((prev) => prev + (e as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  if (loading) return <Spinner />;
  return (
    <>
      <Link className="back" to="/gerenciar">
        <ArrowLeft size={18} />
        VOLTAR AO GERENCIAMENTO
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{id ? 'REVISÃO DE PROCESSO' : 'NOVO PROCESSO'}</span>
          <h1>{id ? 'Editar receita' : 'Cadastrar receita'}</h1>
          <p>Confira os parâmetros antes de publicar para a operação.</p>
        </div>
      </div>
      <Alert>{error}</Alert>
      <form onSubmit={save} className="editor">
        <fieldset disabled={busy || Boolean(id && !version)}>
          <section className="panel">
            <h2>Identificação</h2>
            <div className="form-grid">
              <label>
                Código
                <input value={code} readOnly />
              </label>
              <label className="full">
                Descrição do artigo
                <input
                  required
                  value={draft.descricao}
                  onChange={(e) => set('descricao', e.target.value)}
                  placeholder="Nome técnico, código do produto e nome popular"
                />
              </label>
              <div className="full photo-editor">
                <Photo path={draft.foto} />
                <div>
                  <label className="file-input">
                    <Upload size={18} />
                    Foto do tecido · opcional
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <small>{file ? file.name : 'JPEG, PNG ou WebP · original até 10 MB'}</small>
                  {(draft.foto || file) && (
                    <button
                      type="button"
                      onClick={() => {
                        set('foto', null);
                        setFile(null);
                      }}
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>Parâmetros da RAMA</h2>
            <div className="form-grid parameters-form">
              {(
                [
                  ['velocidade', 'Velocidade', 'm/min'],
                  ['temperatura', 'Temperatura', '°C'],
                  ['banho', 'Banho', 'g/L'],
                  ['largura', 'Largura', 'm'],
                ] as const
              ).map(([key, label, unit]) => (
                <label key={key}>
                  {label}
                  <div className="unit-input">
                    <input
                      type="text"
                      required
                      inputMode={key === 'temperatura' ? 'numeric' : 'decimal'}
                      value={draft[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                    <span>{unit}</span>
                  </div>
                </label>
              ))}
              <label>
                Alimentação
                <input
                  required
                  inputMode="text"
                  autoComplete="off"
                  pattern="[A-Z0-9]{2}(-[A-Z0-9]{2}){3}"
                  placeholder="XX-XX-XX-XX"
                  value={draft.alimentacao}
                  onChange={(e) => {
                    const input = e.target;
                    const raw = input.value;
                    const before = raw
                      .slice(0, input.selectionStart ?? raw.length)
                      .replace(/[^A-Za-z0-9]/g, '').length;
                    const next = maskFeed(raw);
                    set('alimentacao', next);
                    requestAnimationFrame(() => {
                      const pos = Math.min(
                        next.length,
                        before + Math.floor(Math.max(0, before - 1) / 2),
                      );
                      input.setSelectionRange(pos, pos);
                    });
                  }}
                  onKeyDown={(e) => {
                    const input = e.currentTarget;
                    const p = input.selectionStart ?? 0;
                    if (
                      e.key === 'Backspace' &&
                      input.selectionEnd === p &&
                      p > 0 &&
                      draft.alimentacao[p - 1] === '-'
                    ) {
                      e.preventDefault();
                      const next = maskFeed(
                        draft.alimentacao.slice(0, p - 2) + draft.alimentacao.slice(p),
                      );
                      set('alimentacao', next);
                      requestAnimationFrame(() => input.setSelectionRange(p - 2, p - 2));
                    }
                  }}
                />
                <small>4 grupos de 2 letras ou números.</small>
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>Informações adicionais</h2>
            <label>
              Observações e orientações técnicas
              <textarea
                rows={6}
                value={draft.observacao}
                onChange={(e) => set('observacao', e.target.value)}
              />
            </label>
            <label className="status-field">
              Status
              <select
                value={draft.status}
                onChange={(e) => set('status', e.target.value as Status)}
              >
                <option value="RASCUNHO">RASCUNHO · somente supervisão</option>
                <option value="ATIVA">ATIVA · disponível aos operadores</option>
                <option value="INATIVA">INATIVA · somente supervisão</option>
              </select>
            </label>
          </section>
          <div className="form-actions">
            <Link className="button" to="/gerenciar">
              Cancelar
            </Link>
            <button className="primary" disabled={busy}>
              <Save size={18} />
              {busy ? 'Salvando…' : 'SALVAR RECEITA'}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
