import { supabase } from './lib/client';
async function accept() {
  // O SDK processa o fragmento Auth antes de iniciar o HashRouter.
  const { data, error } = await supabase.auth.getSession();
  history.replaceState(null, '', location.pathname);
  if (error || !data.session) {
    document.getElementById('status')!.textContent =
      'Convite inválido ou expirado. Solicite um novo convite à supervisão.';
    return;
  }
  const { error: verified } = await supabase.auth.getUser();
  if (verified) {
    document.getElementById('status')!.textContent = 'Não foi possível validar sua sessão.';
    return;
  }
  location.replace(`${import.meta.env.BASE_URL}#/senha`);
}
void accept();
