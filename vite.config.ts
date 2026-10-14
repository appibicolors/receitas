import { defineConfig, loadEnv } from 'vite';
import { isAdministrativeKey } from './src/lib/public-key';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (isAdministrativeKey(publicKey))
    throw Error('Chave administrativa proibida nas variáveis VITE.');
  if (process.env.RAMA_REQUIRE_CONFIG === 'true' && (!publicKey || !env.VITE_SUPABASE_URL))
    throw Error('Configure URL e chave pública antes de publicar.');
  return {
    plugins: [react(), tailwindcss()],
    base: '/receitas/',
    build: {
      sourcemap: false,
      rollupOptions: {
        input: { main: 'index.html', convite: 'convite.html' },
        output: {
          manualChunks: {
            supabase: ['@supabase/supabase-js'],
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
