import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { supabase } from './lib/client';
export function Spinner() {
  return (
    <p className="loading" role="status">
      <LoaderCircle className="spin" size={20} /> Carregando…
    </p>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;
}
export function Photo({ path, large = false }: { path: string | null; large?: boolean }) {
  const [url, setUrl] = useState('');
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setUrl('');
    const load = () => {
      if (!path) return;
      void supabase.storage
        .from('rama-fotos')
        .download(path)
        .then(({ data, error }) => {
          if (active && data && !error) {
            objectUrl = URL.createObjectURL(data);
            setUrl(objectUrl);
          }
        });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '200px' },
    );
    if (container.current && path) observer.observe(container.current);
    return () => {
      active = false;
      observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return (
    <div ref={container} className={`photo ${large ? 'large' : ''}`}>
      {url ? (
        <img loading="lazy" src={url} alt="Identificação visual do tecido" />
      ) : (
        <div className="placeholder">
          <ImageOff size={large ? 42 : 22} />
          {large && <span>Sem foto disponível</span>}
        </div>
      )}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status.toLowerCase()}`}>{status}</span>;
}
