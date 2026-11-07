import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sourceFile = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findNode(predicate) {
  let found;
  const visit = (node) => { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); };
  visit(sourceFile);
  assert.ok(found, 'expected App declaration was not found');
  return found;
}
function statement(node) {
  let current = node;
  while (current && !ts.isStatement(current)) current = current.parent;
  return appSource.slice(current.getStart(sourceFile), current.end);
}
const loadDeclaration = statement(findNode((n) => ts.isVariableDeclaration(n) && n.name.getText(sourceFile) === 'loadAllData'));
const loadRefAssignment = statement(findNode((n) => ts.isBinaryExpression(n) && n.left.getText(sourceFile) === 'loadAllDataRef.current'));
const previousDeclaration = statement(findNode((n) => ts.isVariableDeclaration(n) && n.name.getText(sourceFile) === 'previousUserId'));
const previousEffect = statement(findNode((n) => ts.isCallExpression(n) && n.expression.getText(sourceFile) === 'useEffect' && n.getText(sourceFile).includes('previousUserId.current')));

function compileHarness() {
  // Execute the actual App callback/effect, not a separately maintained loader.
  // Hooks and DB calls are isolated mocks; this is not a React DOM integration test.
  const source = `
    function createHarness() {
      let data = {};
      const EMPTY_DATA = {};
      let batchGate = null;
      const gates = [];
      const calls = [];
      const refs = [];
      let hookIndex = 0;
      const useRef = (initial) => {
        const index = hookIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      };
      const useCallback = (callback) => callback;
      const useEffect = (effect) => { effect(); };
      const setData = (next) => { data = next; };
      const setLoading = () => {};
      const setLoadError = () => {};
      const db = new Proxy({}, { get: (_, name) => () => {
        if (name === 'getSettings') {
          batchGate = gates.shift();
          if (!batchGate) throw new Error('Unexpected extra database load');
          calls.push(batchGate.userId);
        }
        return batchGate.promise;
      }});
      const window = { setTimeout };
      const render = (currentUser) => {
        hookIndex = 0;
        const dataRef = useRef(data); dataRef.current = data;
        const loadSequence = useRef(0);
        const loadInFlight = useRef(null);
        const loadInFlightUserId = useRef(undefined);
        const refreshQueued = useRef(false);
        const userRef = useRef(currentUser?.authUserId); userRef.current = currentUser?.authUserId;
        const loadAllDataRef = useRef(async () => undefined);
        ${loadDeclaration}
        ${loadRefAssignment}
        ${previousDeclaration}
        ${previousEffect}
        return loadAllData;
      };
      const makeGate = (userId) => {
        let complete;
        const promise = new Promise((resolve) => { complete = resolve; });
        const gate = { promise, userId, resolve: () => complete({ owner: userId }) };
        gates.push(gate);
        return gate;
      };
      return { render, makeGate, calls, get data() { return data; }, get flight() { return refs[2].current; } };
    }
    globalThis.createHarness = createHarness;
  `;
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const context = { Promise, setTimeout, clearTimeout, console, globalThis: {} };
  vm.runInNewContext(output, context);
  return context.globalThis.createHarness();
}
function user(id, extra = {}) { return { authUserId: id, role: 'manager', ...extra }; }
function tick() { return new Promise((resolve) => setTimeout(resolve, 10)); }

test('A to B ignores late A and stale callbacks without clearing B flight', async () => {
  const h = compileHarness();
  const a = h.makeGate('A');
  const loadA = h.render(user('A'));
  const requestA = loadA();
  await Promise.resolve();
  const b = h.makeGate('B');
  const requestB = h.render(user('B'))();
  const flightB = h.flight;
  await loadA();
  a.resolve(); await requestA;
  assert.deepEqual(Array.from(h.calls), ['A', 'B']);
  assert.deepEqual(Object.keys(h.data), [], 'late A cannot populate B snapshot');
  assert.equal(h.flight, flightB, 'late A finally cannot clear B flight');
  b.resolve(); await requestB;
  assert.equal(h.data.settings.owner, 'B');
  assert.equal(h.flight, null);
});

test('logout while pending clears data and cancels queued refresh from that account', async () => {
  const h = compileHarness();
  const pending = h.makeGate('A');
  const load = h.render(user('A'));
  const request = load();
  await Promise.resolve();
  void load();
  h.render(null);
  pending.resolve(); await request; await tick();
  assert.deepEqual(Array.from(h.calls), ['A']);
  assert.deepEqual(Object.keys(h.data), []);
  assert.equal(h.flight, null);
});

test('same-user rerender preserves refs and queues a refresh behind the first request', async () => {
  const h = compileHarness();
  const first = h.makeGate('A');
  const initial = h.render(user('A'))();
  await Promise.resolve();
  void h.render(user('A'))();
  const second = h.makeGate('A');
  first.resolve(); await initial; await tick();
  assert.deepEqual(Array.from(h.calls), ['A', 'A']);
  assert.equal(h.data.settings.owner, 'A', 'same-user rerender did not invalidate initial result');
  second.resolve(); await tick();
  assert.equal(h.flight, null);
});

test('registration-only and disabled accounts release flight before same-identity approval', async () => {
  for (const flags of [{ registrationOnly: true }, { accountDisabled: true }]) {
    const h = compileHarness();
    await h.render(user('A', flags))();
    assert.equal(h.flight, null, 'early return must not leave a settled flight cached');
    assert.deepEqual(Array.from(h.calls), []);
    const approvedGate = h.makeGate('A');
    const approved = h.render(user('A'))();
    approvedGate.resolve(); await approved;
    assert.deepEqual(Array.from(h.calls), ['A']);
    assert.equal(h.data.settings.owner, 'A');
  }
});
