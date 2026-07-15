import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkEdgeExpectation,
  checkNoLabelExpectation,
  checkNodeExpectation,
  parseFlows,
  run,
  validateFlows,
} from './verify-flowcharts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectHtml = path.resolve(here, '../../../../webpresent.html');

test('parses the three active buildDio flow definitions', () => {
  const flows = parseFlows(readFileSync(projectHtml, 'utf8'));

  assert.deepEqual([...flows.keys()], ['fbox1', 'fbox2', 'fbox3']);
  assert.equal(flows.get('fbox3').nodes.find((node) => node.id === 'c1b').l, 2);
  assert.equal(flows.get('fbox2').edges.find((edge) => edge.f === 'b2n' && edge.t === 'b3').route, 'downIn');
});

test('reports duplicate ids, invalid lanes, and dangling edges', () => {
  const invalid = new Map([
    ['fboxX', {
      nodes: [
        { id: 'same', l: 0, r: 0, w: 100, h: 50 },
        { id: 'same', l: 7, r: 1, w: 100, h: 50 },
      ],
      edges: [{ f: 'same', t: 'missing' }],
    }],
  ]);

  const errors = validateFlows(invalid);

  assert.ok(errors.some((error) => error.includes('duplicate node id')));
  assert.ok(errors.some((error) => error.includes('lane must be 0-6')));
  assert.ok(errors.some((error) => error.includes('missing target')));
});

test('checks node, edge, and absent-label expectations', () => {
  const flows = parseFlows(readFileSync(projectHtml, 'utf8'));

  assert.equal(checkNodeExpectation(flows, 'fbox3:c1b:l=2'), null);
  assert.equal(checkEdgeExpectation(flows, 'fbox3:a3:pay:lb=收款'), null);
  assert.equal(checkNoLabelExpectation(flows, 'fbox3:pay:fin'), null);
  assert.match(checkNodeExpectation(flows, 'fbox3:c1b:l=0'), /expected l=0/);
});

test('parses comments and quoted parentheses without ending the call early', () => {
  const source = `
    buildDio('fboxX', 'marker', [200], 2, 80, [
      // A parenthesis in text must not end parsing: )
      {id:'a', l:0, r:0, w:100, h:50, t:'text )'},
      /* A block comment containing ) is also harmless. */
      {id:'b', l:1, r:1, w:100, h:50, t:"quoted )"}
    ], [
      {f:'a', t:'b', route:'newRoute'}
    ]);
  `;
  const flows = parseFlows(source, ['fboxX']);
  const errors = validateFlows(flows);

  assert.equal(flows.get('fboxX').nodes.length, 2);
  assert.ok(errors.some((error) => error.includes('unknown route newRoute')));
  assert.ok(errors.some((error) => error.includes('has no renderer branch')));
});

test('reports missing and unterminated active calls', () => {
  assert.throws(() => parseFlows('', ['fboxX']), /missing active buildDio call/);
  assert.throws(
    () => parseFlows("buildDio('fboxX', 'm', [], 1, 80, [", ['fboxX']),
    /unterminated buildDio call/,
  );
});

test('runs the CLI in help, pass, and expectation-failure modes', () => {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message) => logs.push(String(message));
  console.error = (message) => errors.push(String(message));
  try {
    assert.equal(run(['--help']), 0);
    assert.equal(run([
      projectHtml,
      '--expect-node', 'fbox3:c1b:l=2',
      '--expect-edge', 'fbox3:a3:pay:lb=收款',
      '--expect-no-label', 'fbox3:pay:fin',
    ]), 0);
    assert.equal(run([projectHtml, '--expect-node', 'fbox3:c1b:l=0']), 1);
    assert.throws(() => run(['--unknown']), /unknown option/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.ok(logs.some((line) => line.includes('Usage:')));
  assert.ok(logs.some((line) => line.includes('PASS all flowchart source checks')));
  assert.ok(errors.some((line) => line.includes('expected l=0')));
});

test('ignores stale commented calls and selects the last active flow definition', () => {
  const source = `
    /* buildDio('fboxX', 'old', [200], 1, 80,
      [{id:'stale', l:0, r:0, w:100, h:50}], []); */
    buildDio('fboxX', 'first', [200], 1, 80,
      [{id:'first', l:0, r:0, w:100, h:50}], []);
    buildDio('fboxX', 'active', [200], 1, 80,
      [{id:'active', l:0, r:0, w:100, h:50}], []);
  `;

  const flow = parseFlows(source, ['fboxX']).get('fboxX');

  assert.equal(flow.markerId, 'active');
  assert.equal(flow.nodes[0].id, 'active');
});

test('detects route branches inside buildDio despite spacing and ignores comments', () => {
  const source = `
    function buildDio() {
      if (e.route === 'downIn') return true;
      /* e.route==='leftIn' is documentation, not an implementation. */
    }
    buildDio('fboxX', 'marker', [200], 2, 80, [
      {id:'a', l:0, r:0, w:100, h:50},
      {id:'b', l:1, r:1, w:100, h:50}
    ], [
      {f:'a', t:'b', route:'downIn'},
      {f:'b', t:'a', route:'leftIn'}
    ]);
  `;

  const errors = validateFlows(parseFlows(source, ['fboxX']));

  assert.ok(!errors.some((error) => error.includes('downIn has no renderer branch')));
  assert.ok(errors.some((error) => error.includes('leftIn has no renderer branch')));
});

test('reports a clear CLI error when a flag value is missing', () => {
  assert.throws(
    () => run([projectHtml, '--expect-node']),
    /missing value for --expect-node/,
  );
});
