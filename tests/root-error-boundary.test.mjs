import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/components/RootErrorBoundary.tsx', import.meta.url), 'utf8');
// The test CLI does not read tsconfig.app.json's JSX option through the root
// references. Transpile just this component with the application's JSX mode.
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports = {};
let reloads = 0;
vm.runInNewContext(code, {
  exports,
  require: createRequire(import.meta.url),
  window: { location: { reload: () => reloads++ } },
});
const { RootErrorBoundary } = exports;

test('root error boundary is eagerly imported and wraps the lazy route suspense', () => {
  assert.match(main, /import \{ RootErrorBoundary \} from '\.\/components\/RootErrorBoundary'/);
  assert.match(main, /<RootErrorBoundary lang=\{initialLang\}>\s*<Suspense[\s\S]*<\/Suspense>\s*<\/RootErrorBoundary>/);
  for (const route of ['App', 'AcademyHome', 'OAuthConsent', 'LegalPage']) {
    assert.match(main, new RegExp(`const ${route} = lazy\\(`));
  }
});

test('root boundary preserves children before a render or chunk error', () => {
  const child = 'Synthetic route';
  const boundary = new RootErrorBoundary({ children: child, lang: 'en' });
  assert.equal(boundary.render(), child);
});

test('error fallback is accessible, localized, and does not expose error details', () => {
  for (const [lang, title, direction] of [['ar', 'تعذر عرض الصفحة', 'rtl'], ['en', 'Unable to display this page', 'ltr']]) {
    const boundary = new RootErrorBoundary({ children: 'Synthetic route', lang });
    // Exercise the error lifecycle and rendered fallback without a DOM renderer.
    boundary.state = RootErrorBoundary.getDerivedStateFromError(new Error('private internal detail'));
    const markup = renderToStaticMarkup(boundary.render());
    assert.ok(markup.includes(title));
    assert.ok(markup.includes(`dir="${direction}"`));
    assert.ok(markup.includes('role="alert"'));
    assert.ok(markup.includes('type="button"'));
    assert.ok(!markup.includes('private internal detail'));
    assert.ok(!markup.includes('Synthetic route'));
  }
});

test('retry reloads the document rather than retrying a cached rejected lazy import', () => {
  reloads = 0;
  const boundary = new RootErrorBoundary({ children: null, lang: 'en' });
  boundary.state = RootErrorBoundary.getDerivedStateFromError();
  const button = boundary.render().props.children.find(child => child.type === 'button');
  button.props.onClick();
  assert.equal(reloads, 1);
});
