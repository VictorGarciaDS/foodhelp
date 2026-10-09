import { useEffect, useState } from 'react';

export function useResource<T>(loader: () => Promise<T>, dependencyKey: string | number) {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(null);
    loader().then((value) => {
      if (active) setData(value);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los datos.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [dependencyKey, retryCount]);

  return { data, busy, error, reload: () => setRetryCount((count) => count + 1) };
}