import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens a page's "create" form when the URL carries `?new=1`, so the global
 * "+ Create" menu lands people straight in the form instead of on the list.
 * The parameter is removed afterwards so a refresh doesn't reopen it.
 */
export const useOpenOnNewParam = (open: () => void) => {
  const [params, setParams] = useSearchParams();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (params.get('new') !== '1') return;
    openRef.current();
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);
};
