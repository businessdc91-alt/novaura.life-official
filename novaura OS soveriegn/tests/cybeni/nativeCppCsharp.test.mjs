// Tests for Cybeni C++20 & C# (.NET) standalone environments, massive reference blueprints,
// deterministic delimiter/include/entry static checks, starters/Visual Twin, and compiler repair loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSHARP_AND_CPP_STANDALONE_INTEGRATIONS } from '../../src/services/integrations/csharpAndCppStandaloneIntegrations.js';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATIONS_LIBRARY,
  filterIntegrations,
} from '../../src/services/cybeniIntegrationsLibrary.js';
import {
  detectNativeLanguage,
  nativeReferenceNotes,
  checkBalancedDelimiters,
  nativeStaticCheck,
  generateNativeBuildFiles,
} from '../../src/services/cybeni/nativeReference.js';
import { pickStarter, starterFiles } from '../../src/services/cybeni/starters.js';
import { buildPreview, staticCheck } from '../../src/services/cybeni/previewBuilder.js';
import { buildNativeSourceBundleFiles } from '../../src/services/cybeni/nativeCompiler.js';
import * as P from '../../src/services/cybeni/pipeline.js';

test('Cybeni Integrations Library includes all 10 C++20 and C# standalone reference blueprints', () => {
  assert.equal(CSHARP_AND_CPP_STANDALONE_INTEGRATIONS.length, 10);
  assert.ok(INTEGRATION_CATEGORIES.some(c => c.id === 'cpp_csharp_standalone'));

  const filtered = filterIntegrations('cpp_csharp_standalone', '');
  assert.equal(filtered.length, 10);
  assert.ok(INTEGRATIONS_LIBRARY.length >= 20);

  for (const item of CSHARP_AND_CPP_STANDALONE_INTEGRATIONS) {
    assert.ok(item.id && item.title && item.code.length > 500, `blueprint ${item.id} has substantial code`);
    assert.ok(Array.isArray(item.faqs) && item.faqs.length >= 1, `blueprint ${item.id} includes FAQs`);
    assert.ok(item.aiPrompt.length > 30, `blueprint ${item.id} includes AI execution prompt`);
    const bal = checkBalancedDelimiters(item.code);
    assert.equal(bal.ok, true, `blueprint ${item.id} has balanced {}, (), []: ${bal.error || ''}`);
  }
});

test('native language detection, reference guides, and starter Visual Twins', () => {
  assert.equal(detectNativeLanguage('build a C++20 Direct2D desktop synthesizer', []), 'cpp');
  assert.equal(detectNativeLanguage('create a C# WinForms system tray app', []), 'csharp');
  assert.equal(detectNativeLanguage('build a todo web app', ['src/App.jsx']), null);
  assert.equal(detectNativeLanguage('web app', ['Program.cs']), 'csharp');
  assert.equal(detectNativeLanguage('web app', ['src/main.cpp']), 'cpp');

  assert.equal(pickStarter('make a C++20 Raylib desktop game'), 'cpp');
  assert.equal(pickStarter('build a C# .NET WPF task manager'), 'csharp');
  assert.equal(pickStarter('make a snake game with a high score'), 'game');

  assert.ok(nativeReferenceNotes('cpp').includes('-std=c++20'));
  assert.ok(nativeReferenceNotes('csharp').includes('System.Windows.Forms'));

  const cppStarter = starterFiles('cpp');
  const cppPreview = buildPreview(cppStarter, { mode: 'server', baseUrl: 'http://cyprev.localhost/cpp1/' });
  assert.equal(cppPreview.issues.length, 0, 'C++ starter passes full staticCheck and Visual Twin build');
  assert.ok(cppPreview.html.includes('C++20 Visual Twin Preview'));
  assert.ok(cppPreview.serverFiles.some(f => f.path === 'src/App.jsx' && f.content.includes('Cybeni Native C++20')));

  const csStarter = starterFiles('csharp');
  const csPreview = buildPreview(csStarter, { mode: 'server', baseUrl: 'http://cyprev.localhost/cs1/' });
  assert.equal(csPreview.issues.length, 0, 'C# starter passes full staticCheck and Visual Twin build');
  assert.ok(csPreview.html.includes('C# (.NET) Visual Twin Preview'));
  assert.ok(csPreview.serverFiles.some(f => f.path === 'src/App.jsx' && f.content.includes('Cybeni Native C#')));
});

test('checkBalancedDelimiters handles C++ digit separators, raw strings, verbatim strings, and catches errors', () => {
  const validCpp = `
#include <iostream>
int main() {
    int budget = 1'000'000;
    const char* raw = R"tag(unclosed { brace ( inside raw string )tag";
    std::string s = "escaped \\" quote { }";
    char c = '{'; // comment with unclosed (
    return budget > 0 ? 0 : 1;
}`;
  assert.deepEqual(checkBalancedDelimiters(validCpp), { ok: true });

  const broken = 'int main() {\n  if (true) {\n    return 0;\n}';
  const res = checkBalancedDelimiters(broken);
  assert.equal(res.ok, false);
  assert.ok(res.error.includes("Unclosed '{'"));
});

test('nativeStaticCheck detects unbalanced C#/C++ syntax, missing main, and missing local includes', () => {
  const badCpp = [
    { path: 'src/main.cpp', content: '#include "missing_header.hpp"\nint helper() {\n  return 1;\n' },
  ];
  const issues = nativeStaticCheck(badCpp);
  assert.ok(issues.some(i => i.type === 'native-syntax'), 'reports unbalanced brace');
  assert.ok(issues.some(i => i.type === 'native-missing-include'), 'reports missing local #include');
  assert.ok(issues.some(i => i.type === 'native-no-entry'), 'reports missing main()');

  const badCs = [
    { path: 'Helper.cs', content: 'public class Helper { public void Foo() { } }' },
  ];
  assert.ok(nativeStaticCheck(badCs).some(i => i.type === 'native-no-entry'));

  // staticCheck on native project without HTML Visual Twin should not emit false JS no-entry error
  const pureCpp = [{ path: 'main.cpp', content: 'int main() { return 0; }' }];
  assert.equal(staticCheck(pureCpp).length, 0);
});

test('generateNativeBuildFiles and buildNativeSourceBundleFiles produce CMakeLists.txt, .csproj, and build.ps1', () => {
  const cppGen = generateNativeBuildFiles('cpp', 'WaveSynth', [
    { path: 'src/main.cpp', content: '#include <windows.h>\n#include <d2d1.h>\nint WINAPI wWinMain(HINSTANCE,HINSTANCE,PWSTR,int){return 0;}' },
  ]);
  const cppCmake = cppGen.find(f => f.path === 'CMakeLists.txt');
  const cppPs1 = cppGen.find(f => f.path === 'build.ps1');
  assert.ok(cppCmake && cppCmake.content.includes('WIN32') && cppCmake.content.includes('d2d1'));
  assert.ok(cppPs1 && cppPs1.content.includes('-std=c++20') && cppPs1.content.includes('-mwindows'));

  const csBundle = buildNativeSourceBundleFiles('TrayTool', [
    { path: 'Program.cs', content: 'using System.Windows.Forms;\nclass P { static void Main() {} }' },
  ]);
  assert.equal(csBundle.lang, 'csharp');
  const csproj = csBundle.files.find(f => f.path.endsWith('.csproj'));
  assert.ok(csproj && csproj.content.includes('<UseWindowsForms>true</UseWindowsForms>'));
  assert.ok(csproj.content.includes('<PublishSingleFile>true</PublishSingleFile>'));
});

test('pipeline injects C++ reference guide and auto-repairs compiler errors via compileNative hook', async () => {
  const prompts = [];
  let fixedCpp = false;
  const runModel = async (key, messages) => {
    const user = messages[1].content;
    prompts.push({ key, user });
    const task = user.slice(user.lastIndexOf('## Your task'));
    if (task.includes('failed with these problems')) {
      fixedCpp = true;
      return '```src/main.cpp\n#include <iostream>\nint main(){ std::cout << "ok"; return 0; }\n```';
    }
    return '```src/main.cpp\n#include <iostream>\nint main(){ missing_symbol(); return 0; }\n```';
  };

  const compileNative = async (files) => {
    const src = files.find(f => f.path === 'src/main.cpp')?.content || '';
    const bad = src.includes('missing_symbol');
    return {
      ok: !bad,
      lang: 'cpp',
      compiler: 'g++',
      errors: bad ? ["src/main.cpp:2: error: 'missing_symbol' was not declared in this scope"] : [],
    };
  };

  const out = await P.runPipeline({
    request: 'Write a C++20 CLI metrics analyzer',
    mode: 'quick',
    files: starterFiles('cpp'),
    roles: { architect: 'arch', developer: 'dev', reviewer: 'rev', designer: 'dev' },
  }, {
    runModel,
    compileNative,
    verify: async () => ({ errors: [], blank: false, visualIssues: [], tests: [] }),
  });

  assert.equal(out.status, 'done');
  assert.equal(out.runtimeClean, true, 'C++ compiler error repaired by runtime-fix loop');
  assert.ok(fixedCpp);
  assert.ok(prompts[0].user.includes('C++20 Standalone Reference & Build Rules'), 'C++ reference guide injected');
  assert.ok(prompts.some(p => p.user.includes("Native compiler error: src/main.cpp:2: error: 'missing_symbol'")));
});
