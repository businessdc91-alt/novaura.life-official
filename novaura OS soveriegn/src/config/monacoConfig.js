/**
 * Sovereign OS — Local Offline Monaco Editor Configuration
 *
 * Configures @monaco-editor/react to use local bundled monaco-editor and
 * standard module web workers via `new Worker(new URL(..., import.meta.url))`.
 * Eliminates external CDN fetches, enabling 100% air-gapped, offline code editing
 * inside Tauri desktop & Web.
 */

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/language/json/json.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(
          new URL('monaco-editor/language/css/css.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/language/html/html.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(
          new URL('monaco-editor/language/typescript/ts.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      return new Worker(
        new URL('monaco-editor/editor/editor.worker.js', import.meta.url),
        { type: 'module' }
      );
    },
  };

  // Bind @monaco-editor/react to the locally bundled monaco instance
  loader.config({ monaco });
}

export { monaco };
