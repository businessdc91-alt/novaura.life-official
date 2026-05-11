import { useEffect } from 'react';
import { useKernel } from './useKernel';

/**
 * useSemanticRegistration
 * 
 * Allows a React component (e.g. an App Window) to expose internal functions to the AI via SemanticsEngine.
 * Registers capabilities upon mount, unregisters on unmount.
 *
 * @param {string} pluginId - The unique ID or domain of the application (e.g. 'terminal', 'ide', 'calculator')
 * @param {object} capabilities - An object mapping action strings to async functions. 
 *                               e.g. { execute: async ({ command }) => { ... }, clear: async () => { ... } }
 * @param {object} meta - Optional metadata to describe the plugin to the system.
 */
export function useSemanticRegistration(pluginId, capabilities, meta = {}) {
  const kernel = useKernel();

  useEffect(() => {
    if (!kernel || !kernel.plugins) return;

    // Register all provided capabilities into the PluginRegistry
    const unregister = kernel.plugins.registerPlugin(pluginId, meta, capabilities);

    return () => {
      unregister();
    };
  }, [pluginId, kernel, capabilities, meta]);
}

export default useSemanticRegistration;
