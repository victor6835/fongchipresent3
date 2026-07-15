#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DEFAULT_BOX_IDS = ['fbox1', 'fbox2', 'fbox3'];
const IMPLEMENTED_ROUTES = ['leftIn', 'downIn', 'loopL', 'brR'];

function findCodeOccurrences(source, needles) {
  const matches = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    const needle = needles.find((candidate) => source.startsWith(candidate, index));
    if (needle) {
      matches.push(index);
      index += needle.length - 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
  }
  return matches;
}

function findClosingDelimiter(source, open, opening, closing) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function extractBuildDioCall(source, boxId) {
  const needles = [`buildDio('${boxId}'`, `buildDio("${boxId}"`];
  const starts = findCodeOccurrences(source, needles);
  const start = starts.at(-1);
  if (start === undefined) throw new Error(`missing active buildDio call for ${boxId}`);

  const open = source.indexOf('(', start);
  const close = findClosingDelimiter(source, open, '(', ')');
  if (close >= 0) return source.slice(start, close + 1);

  throw new Error(`unterminated buildDio call for ${boxId}`);
}

function stripComments(source) {
  let output = '';
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      output += char === '\n' ? '\n' : ' ';
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      output += char === '\n' ? '\n' : ' ';
      if (char === '*' && next === '/') {
        output += ' ';
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      output += '  ';
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      output += '  ';
      blockComment = true;
      index += 1;
      continue;
    }
    output += char;
    if (char === "'" || char === '"' || char === '`') quote = char;
  }
  return output;
}

function findImplementedRoutes(source) {
  const starts = findCodeOccurrences(source, ['function buildDio']);
  const start = starts.at(-1);
  if (start === undefined) return new Set();
  const open = source.indexOf('{', start);
  const close = findClosingDelimiter(source, open, '{', '}');
  if (close < 0) return new Set();

  const functionSource = stripComments(source.slice(start, close + 1));
  const routes = new Set();
  const pattern = /e\.route\s*===\s*(['"])([^'"]+)\1/g;
  for (const match of functionSource.matchAll(pattern)) routes.add(match[2]);
  return routes;
}

function evaluateFlowCall(call, expectedBoxId) {
  let captured;
  const sandbox = {
    buildDio: (...args) => { captured = args; },
  };
  vm.runInNewContext(`${call};`, sandbox, {
    timeout: 500,
    contextCodeGeneration: { strings: false, wasm: false },
  });
  if (!captured) throw new Error(`buildDio did not execute for ${expectedBoxId}`);

  const [boxId, markerId, laneWidths, rows, rowHeight, nodes, edges] = captured;
  if (boxId !== expectedBoxId) throw new Error(`expected ${expectedBoxId}, got ${boxId}`);
  return { boxId, markerId, laneWidths, rows, rowHeight, nodes, edges };
}

export function parseFlows(source, boxIds = DEFAULT_BOX_IDS) {
  const flows = new Map();
  for (const boxId of boxIds) {
    flows.set(boxId, evaluateFlowCall(extractBuildDioCall(source, boxId), boxId));
  }
  Object.defineProperty(flows, 'source', { value: source });
  Object.defineProperty(flows, 'implementedRoutes', { value: findImplementedRoutes(source) });
  return flows;
}

export function validateFlows(flows) {
  const errors = [];
  for (const [boxId, flow] of flows) {
    const ids = new Set();
    for (const node of flow.nodes || []) {
      if (ids.has(node.id)) errors.push(`${boxId}: duplicate node id ${node.id}`);
      ids.add(node.id);
      if (!Number.isInteger(node.l) || node.l < 0 || node.l > 6) {
        errors.push(`${boxId}:${node.id}: lane must be 0-6`);
      }
      if (!Number.isFinite(node.r)) errors.push(`${boxId}:${node.id}: row must be numeric`);
    }
    for (const edge of flow.edges || []) {
      if (!ids.has(edge.f)) errors.push(`${boxId}:${edge.f}->${edge.t}: missing source`);
      if (!ids.has(edge.t)) errors.push(`${boxId}:${edge.f}->${edge.t}: missing target`);
      if (edge.route && !IMPLEMENTED_ROUTES.includes(edge.route)) {
        errors.push(`${boxId}:${edge.f}->${edge.t}: unknown route ${edge.route}`);
      }
      if (edge.route && flows.implementedRoutes && !flows.implementedRoutes.has(edge.route)) {
        errors.push(`${boxId}:${edge.f}->${edge.t}: route ${edge.route} has no renderer branch`);
      }
    }
  }
  return errors;
}

function parseProperty(text) {
  const equals = text.indexOf('=');
  if (equals < 1) throw new Error(`expected property=value, got ${text}`);
  const key = text.slice(0, equals);
  const raw = text.slice(equals + 1);
  const value = /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
  return { key, value };
}

function findFlow(flows, boxId) {
  const flow = flows.get(boxId);
  if (!flow) throw new Error(`unknown flow ${boxId}`);
  return flow;
}

export function checkNodeExpectation(flows, spec) {
  const [boxId, nodeId, ...propertyParts] = spec.split(':');
  const { key, value } = parseProperty(propertyParts.join(':'));
  const node = findFlow(flows, boxId).nodes.find((item) => item.id === nodeId);
  if (!node) return `${boxId}: missing node ${nodeId}`;
  return Object.is(node[key], value)
    ? null
    : `${boxId}:${nodeId}: expected ${key}=${value}, got ${node[key]}`;
}

function findEdge(flows, boxId, from, to) {
  return findFlow(flows, boxId).edges.find((edge) => edge.f === from && edge.t === to);
}

export function checkEdgeExpectation(flows, spec) {
  const [boxId, from, to, ...propertyParts] = spec.split(':');
  const { key, value } = parseProperty(propertyParts.join(':'));
  const edge = findEdge(flows, boxId, from, to);
  if (!edge) return `${boxId}: missing edge ${from}->${to}`;
  return Object.is(edge[key], value)
    ? null
    : `${boxId}:${from}->${to}: expected ${key}=${value}, got ${edge[key]}`;
}

export function checkNoLabelExpectation(flows, spec) {
  const [boxId, from, to] = spec.split(':');
  const edge = findEdge(flows, boxId, from, to);
  if (!edge) return `${boxId}: missing edge ${from}->${to}`;
  return edge.lb ? `${boxId}:${from}->${to}: expected no label, got ${edge.lb}` : null;
}

function parseArgs(argv) {
  const options = { file: 'webpresent.html', nodes: [], edges: [], noLabels: [] };
  let index = 0;
  if (argv[0] && !argv[0].startsWith('--')) {
    options.file = argv[0];
    index = 1;
  }
  for (; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag.startsWith('--expect-') && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }
    if (flag === '--expect-node') options.nodes.push(argv[++index]);
    else if (flag === '--expect-edge') options.edges.push(argv[++index]);
    else if (flag === '--expect-no-label') options.noLabels.push(argv[++index]);
    else if (flag === '--help') options.help = true;
    else throw new Error(`unknown option ${flag}`);
  }
  return options;
}

function usage() {
  return `Usage: node verify-flowcharts.mjs [webpresent.html]\n\
  [--expect-node fbox3:c1b:l=2]\n\
  [--expect-edge fbox3:a3:pay:lb=收款]\n\
  [--expect-no-label fbox3:pay:fin]`;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const source = readFileSync(path.resolve(options.file), 'utf8');
  const flows = parseFlows(source);
  const errors = validateFlows(flows);
  for (const spec of options.nodes) errors.push(checkNodeExpectation(flows, spec));
  for (const spec of options.edges) errors.push(checkEdgeExpectation(flows, spec));
  for (const spec of options.noLabels) errors.push(checkNoLabelExpectation(flows, spec));
  const failures = errors.filter(Boolean);

  for (const [boxId, flow] of flows) {
    console.log(`PASS ${boxId}: ${flow.nodes.length} nodes, ${flow.edges.length} edges`);
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    return 1;
  }
  console.log('PASS all flowchart source checks');
  return 0;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = run();
