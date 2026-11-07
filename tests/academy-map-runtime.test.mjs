import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/components/DeferredAcademyMap.tsx', import.meta.url),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const require = createRequire(import.meta.url);
const jsxRuntime = require('react/jsx-runtime');

function makeHarness({ intersectionObserver = true } = {}) {
  const observers = [];
  const effects = [];
  const hookState = [];
  let hookIndex = 0;
  let pendingRender = false;
  let effectRegistered = false;
  let tree;
  let cleanup;
  let component;

  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = (...args) => {
        if (this.disconnectCount === 0) callback(...args);
      };
      this.options = options;
      this.observed = [];
      this.disconnectCount = 0;
      observers.push(this);
    }
    observe(node) { this.observed.push(node); }
    disconnect() { this.disconnectCount += 1; }
  }

  const window = intersectionObserver ? { IntersectionObserver: FakeIntersectionObserver } : {};
  const module = { exports: {} };
  const context = {
    console,
    window,
    ...(intersectionObserver ? { IntersectionObserver: FakeIntersectionObserver } : {}),
    module,
    exports: module.exports,
    require: id => id === 'react/jsx-runtime'
      ? jsxRuntime
      : id === 'react'
        ? { useRef: context.useRef, useState: context.useState, useEffect: context.useEffect }
        : require(id),
    useRef(initialValue) {
      const index = hookIndex++;
      if (!hookState[index]) hookState[index] = { current: initialValue };
      return hookState[index];
    },
    useState(initialValue) {
      const index = hookIndex++;
      if (!hookState[index]) hookState[index] = initialValue;
      return [hookState[index], value => {
        hookState[index] = typeof value === 'function' ? value(hookState[index]) : value;
        pendingRender = true;
      }];
    },
    useEffect(effect) {
      hookIndex++;
      if (!effectRegistered) {
        effectRegistered = true;
        effects.push(effect);
      }
    },
  };
  vm.runInNewContext(code, context);
  component = context.module.exports.DeferredAcademyMap;

  function render() {
    hookIndex = 0;
    tree = component({
      title: 'Academy map',
      fallbackHref: 'https://example.test/map',
      fallbackLabel: 'Open map',
      loadingLabel: 'Loading map',
    });
  }
  function mount() {
    render();
    const containerRef = hookState[0];
    if (tree.ref) tree.ref.current = { nodeType: 1 };
    for (const effect of effects.splice(0)) cleanup = effect() || cleanup;
    flush();
    return { containerRef };
  }
  function flush() {
    if (pendingRender) { pendingRender = false; render(); }
  }
  function unmount() {
    if (cleanup) cleanup();
  }
  return { mount, flush, unmount, get tree() { return tree; }, observers, window };
}

function assertFallback(tree) {
  assert.equal(tree.type, 'div');
  assert.equal(tree.props.role, 'status');
  assert.equal(tree.props['aria-live'], 'polite');
  assert.equal(tree.props.children[0].type, 'span');
  assert.equal(tree.props.children[0].props.children, 'Loading map');
  assert.equal(tree.props.children[1].type, 'a');
  assert.equal(tree.props.children[1].props.href, 'https://example.test/map');
  assert.equal(tree.props.children[1].props.target, '_blank');
  assert.equal(tree.props.children[1].props.rel, 'noopener noreferrer');
  assert.equal(tree.props.children[1].props.children, 'Open map');
}

function assertIframe(tree) {
  assert.equal(tree.type, 'iframe');
  assert.equal(tree.props.title, 'Academy map');
  assert.equal(tree.props.loading, 'lazy');
  assert.equal(tree.props.referrerPolicy, 'no-referrer-when-downgrade');
  assert.equal(tree.props.src, 'https://www.google.com/maps?q=Shooter%20Academy%2C%20Halat%20Naim%2C%20Bahrain&output=embed');
}

test('map has no iframe before intersection and observes with the intended margin', () => {
  const h = makeHarness();
  const { containerRef } = h.mount();
  assertFallback(h.tree);
  assert.equal(h.observers.length, 1);
  assert.equal(h.observers[0].options.rootMargin, '400px 0px');
  assert.equal(h.observers[0].observed[0], containerRef.current);
});

test('non-intersecting entries do not activate the iframe', () => {
  const h = makeHarness();
  h.mount();
  h.observers[0].callback([{ isIntersecting: false }]);
  assertFallback(h.tree);
  assert.equal(h.observers[0].disconnectCount, 0);
});

test('first intersecting entry activates once and disconnects the observer', () => {
  const h = makeHarness();
  h.mount();
  const observer = h.observers[0];
  observer.callback([{ isIntersecting: true }]);
  h.flush();
  assertIframe(h.tree);
  assert.equal(observer.disconnectCount, 1);
  observer.callback([{ isIntersecting: true }]);
  assertIframe(h.tree);
  assert.equal(observer.disconnectCount, 1);
});

test('missing IntersectionObserver falls back to immediate iframe activation', () => {
  const h = makeHarness({ intersectionObserver: false });
  h.mount();
  assertIframe(h.tree);
  assert.equal(h.observers.length, 0);
});

test('unmount cleanup disconnects an observer that has not intersected', () => {
  const h = makeHarness();
  h.mount();
  h.unmount();
  assert.equal(h.observers[0].disconnectCount, 1);
});

test('fallback and iframe expose the expected accessible/link properties', () => {
  const h = makeHarness();
  h.mount();
  assertFallback(h.tree);
  h.observers[0].callback([{ isIntersecting: true }]);
  h.flush();
  assertIframe(h.tree);
});
