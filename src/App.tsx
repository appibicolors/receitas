import { useState, type FormEvent } from 'react';
import { Navigate, NavLink, Route, Routes, Outlet, useNavigate } from 'react-router-dom';
import { Search, Plus, LayoutDashboard, Users, LogOut, History, ClipboardList } from 'lucide-react';
import { AuthProvider, useAuth } from './auth';
import { supabase, configured, fail } from './lib/client';
import { Alert, Spinner } from './components';
import { SearchPage, Detail, Dashboard, HistoryPage } from './pages/Recipes';
import Editor from './pages/Editor';
import UsersPage from './pages/Users';
import companyLogo from './assets/ibicolor-logo.png';
function Brand() {
  return (
    <div className="brand">
      <img
        className="brand-logo"
        src={companyLogo}
        alt="Logo da IBICOLORS"
        width={56}
        height={56}
      />
      <div>
        IBICOLORS<small>ACABAMENTO TÊXTIL · RAMA</small>
      </div>
    </div>
  );
}
function Login() {
  const { profile, error: accessError, refresh } = useAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (profile)
    return <Navigate to={profile.perfil === 'SUPERVISOR' ? '/painel' : '/consulta'} replace />;
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw Error('E-mail ou senha inválidos. Verifique os dados e tente novamente.');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-aside">
        <Brand />
        <div>
          <span className="eyebrow">CONTROLE DE PROCESSO</span>
          <h1>
            Precisão em cada
            <br />
            acabamento.
          </h1>
          <p>
            Receitas organizadas. Parâmetros claros.
            <br />
            Informação certa para a operação.
          </p>
        </div>
        <small>IBICOLORS · SISTEMA DE RECEITAS DA RAMA</small>
      </section>
      <section className="login-form">
        <span className="eyebrow">ACESSO INDIVIDUAL</span>
        <h2>Sistema de receitas da RAMA</h2>
        <p>Entre com sua conta autorizada.</p>
        <Alert>
          {!configured
            ? 'Configure as variáveis públicas do Supabase para habilitar o acesso.'
            : error || accessError}
        </Alert>
        <form onSubmit={login}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy || !configured}>
            {busy ? 'Entrando…' : 'ENTRAR'}
          </button>
        </form>
        {accessError && (
          <button onClick={() => void supabase.auth.signOut({ scope: 'local' })}>
            Sair desta conta
          </button>
        )}
        <small>Acesso destinado à equipe autorizada da IBICOLORS.</small>
      </section>
    </main>
  );
}
function Password() {
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      fail(error);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="password panel">
      <h1>Definir senha</h1>
      <p>Use este formulário após abrir o convite autorizado.</p>
      <Alert>{error}</Alert>
      <form onSubmit={save}>
        <label>
          Nova senha
          <input
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          Salvar senha
        </button>
      </form>
    </main>
  );
}
function Guard({ supervisor = false }: { supervisor?: boolean }) {
  const { profile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!profile) return <Navigate to="/login" replace />;
  if (supervisor && profile.perfil !== 'SUPERVISOR') return <Navigate to="/consulta" replace />;
  return <Outlet />;
}
function Layout() {
  const { profile } = useAuth();
  const supervisor = profile?.perfil === 'SUPERVISOR';
  return (
    <div className="app">
      <header>
        <Brand />
        <div className="account">
          <span>
            {profile?.nome}
            <small>{profile?.perfil}</small>
          </span>
          <button title="Sair" onClick={() => void supabase.auth.signOut({ scope: 'local' })}>
            <LogOut size={18} /> <span>SAIR</span>
          </button>
        </div>
      </header>
      {supervisor && (
        <nav aria-label="Menu principal">
          <NavLink to="/painel">
            <LayoutDashboard size={18} />
            Painel
          </NavLink>
          <NavLink to="/consulta">
            <Search size={18} />
            Consultar receitas
          </NavLink>
          <NavLink to="/nova">
            <Plus size={18} />
            Cadastrar receita
          </NavLink>
          <NavLink to="/gerenciar">
            <ClipboardList size={18} />
            Gerenciar receitas
          </NavLink>
          <NavLink to="/usuarios">
            <Users size={18} />
            Usuários
          </NavLink>
          <NavLink to="/historico">
            <History size={18} />
            Histórico
          </NavLink>
        </nav>
      )}
      <main className="content">
        <Outlet />
      </main>
      <footer>
        IBICOLORS · RAMA <span>Horários de Brasília</span>
      </footer>
    </div>
  );
}
function Home() {
  const { profile, loading } = useAuth();
  if (loading) return <Spinner />;
  return (
    <Navigate
      to={!profile ? '/login' : profile.perfil === 'SUPERVISOR' ? '/painel' : '/consulta'}
      replace
    />
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/senha" element={<Password />} />
        <Route element={<Guard />}>
          <Route element={<Layout />}>
            <Route path="/consulta" element={<SearchPage />} />
            <Route path="/receita/:id" element={<Detail />} />
            <Route element={<Guard supervisor />}>
              <Route path="/painel" element={<Dashboard />} />
              <Route path="/gerenciar" element={<SearchPage manage />} />
              <Route path="/nova" element={<Editor />} />
              <Route path="/editar/:id" element={<Editor />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/historico" element={<HistoryPage />} />
              <Route path="/historico/:id" element={<HistoryPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
