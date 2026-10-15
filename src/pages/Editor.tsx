import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Upload, Plus, Trash2 } from 'lucide-react';
import { supabase, fail } from '../lib/client';
import { emptyDraft, toDraft, validate, type Draft, type Recipe, type Status } from '../lib/domain';
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
                  ['pressao_fourlad', 'Pressão Fourlad', 'kgf/cm²'],
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
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{1,2}"
                  maxLength={2}
                  placeholder="0 a 99"
                  value={draft.alimentacao}
                  onChange={(e) => set('alimentacao', e.target.value)}
                />
                <small>Número inteiro com até 2 dígitos.</small>
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>Composição do banho</h2>
            <p className="bath-help">Informe a quantidade em g/L e o produto de cada item.</p>
            <div className="bath-items">
              {draft.banho_itens.map((item, index) => (
                <fieldset className="bath-item" key={index}>
                  <legend>Item {index + 1}</legend>
                  <div className="bath-item-fields">
                    <label>
                      Quantidade
                      <div className="unit-input">
                        <input
                          aria-label={`Quantidade do item ${index + 1}`}
                          type="text"
                          inputMode="decimal"
                          required
                          value={item.quantidade}
                          onChange={(e) =>
                            set(
                              'banho_itens',
                              draft.banho_itens.map((entry, i) =>
                                i === index ? { ...entry, quantidade: e.target.value } : entry,
                              ),
                            )
                          }
                        />
                        <span>g/L</span>
                      </div>
                    </label>
                    <label>
                      Produto
                      <input
                        aria-label={`Produto do item ${index + 1}`}
                        required
                        value={item.produto}
                        placeholder="Ex.: Silicone"
                        onChange={(e) =>
                          set(
                            'banho_itens',
                            draft.banho_itens.map((entry, i) =>
                              i === index ? { ...entry, produto: e.target.value } : entry,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Apagar item ${index + 1} do banho`}
                      onClick={() =>
                        set(
                          'banho_itens',
                          draft.banho_itens.length === 1
                            ? [{ quantidade: '', produto: '' }]
                            : draft.banho_itens.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={18} />
                      Apagar item
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            <button
              type="button"
              className="add-bath-item"
              onClick={() =>
                set('banho_itens', [...draft.banho_itens, { quantidade: '', produto: '' }])
              }
            >
              <Plus size={18} />
              Adicionar item ao banho
            </button>
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
