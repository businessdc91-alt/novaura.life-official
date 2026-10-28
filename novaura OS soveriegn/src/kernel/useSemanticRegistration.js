import { useEffect } from 'react';
import { useKernel } from './useKernel.js';

export function useSemanticRegistration(pluginId, capabilities, meta = {}) {
  const kernel = useKernel();

  useEffect(() => {
    if (!kernel || !kernel.plugins) return;

    const unregister = kernel.plugins.register(pluginId, meta.name || pluginId, capabilities);

    return () => {
      unregister?.();
    };
  }, [pluginId, kernel, capabilities, meta]);
}

export default useSemanticRegistration;
