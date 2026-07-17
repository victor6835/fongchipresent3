'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const {
  AUTO_RETURN_MS,
  FLOW_BY_SLIDE,
  FLOW_PLAYBACK,
  createFlowInteractionController,
} = require('../flow-interactions.js');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeNode {
  constructor(nodeId, boxId) {
    this.dataset = { nodeId };
    this.boxId = boxId;
    this.classList = new FakeClassList();
  }

  closest(selector) {
    if (selector === `#${this.boxId} [data-node-id]`) return this;
    return null;
  }
}

class FakeChildTarget {
  constructor(parent) {
    this.parent = parent;
  }

  closest(selector) {
    return this.parent.closest(selector);
  }
}

class FakeResetTarget {
  constructor(boxId) {
    this.dataset = { flowReset: boxId };
  }

  closest(selector) {
    return selector === '[data-flow-reset]' ? this : null;
  }
}

class FakeFlowNavigationTarget {
  closest(selector) {
    return selector === '[data-flow-navigation]' ? this : null;
  }
}

class FakeDocument {
  constructor(playback) {
    this.slides = new Map();
    this.nodes = new Map();
    this.listeners = new Map();
    Object.entries(playback).forEach(([boxId, steps]) => {
      const ids = new Set(steps.map((step) => (typeof step === 'string' ? step : step.id)));
      this.nodes.set(boxId, new Map([...ids].map((id) => [id, new FakeNode(id, boxId)])));
    });
    this.activeSlideId = null;
  }

  setActiveSlide(id) {
    this.activeSlideId = id;
  }

  querySelector(selector) {
    if (selector === '.slide.active') {
      return this.activeSlideId ? { id: this.activeSlideId } : null;
    }
    const match = selector.match(/^#([^ ]+) \[data-node-id="([^"]+)"\]$/);
    if (match) return this.nodes.get(match[1])?.get(match[2]) || null;
    return null;
  }

  querySelectorAll(selector) {
    const match = selector.match(/^#([^ ]+) \[data-node-id\]$/);
    return match ? [...(this.nodes.get(match[1])?.values() || [])] : [];
  }

  addEventListener(type, listener, capture) {
    this.listeners.set(type, { listener, capture });
  }

  removeEventListener(type, listener, capture) {
    const registered = this.listeners.get(type);
    if (registered?.listener === listener && registered.capture === capture) this.listeners.delete(type);
  }

  dispatchPointer(event) {
    this.listeners.get('pointerdown')?.listener(event);
  }
}

function createFakeTimers() {
  let nextId = 1;
  const timers = [];
  return {
    setTimer(callback, delay) {
      const timer = { id: nextId++, callback, delay, cleared: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimer(id) {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    },
    runNext() {
      const timer = timers.find((entry) => !entry.cleared);
      assert.ok(timer, 'expected a pending timer');
      timer.cleared = true;
      timer.callback();
      return timer;
    },
    pendingCount() {
      return timers.filter((timer) => !timer.cleared).length;
    },
  };
}

function createFixture() {
  const documentRef = new FakeDocument(FLOW_PLAYBACK);
  const timers = createFakeTimers();
  const controller = createFlowInteractionController({
    documentRef,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { controller, documentRef, timers };
}

function node(documentRef, boxId, nodeId) {
  return documentRef.querySelector(`#${boxId} [data-node-id="${nodeId}"]`);
}

function advanceTimes(controller, boxId, count) {
  for (let index = 0; index < count; index += 1) controller.advance(boxId);
}

test('exports the exact immutable playback tables', () => {
  assert.equal(AUTO_RETURN_MS, 700);
  assert.deepEqual(FLOW_BY_SLIDE, { s7: 'fbox1', s8: 'fbox2', s9: 'fbox3' });
  const expected = {
    fbox1: [
      'st', 'n1', 'n2', 'no', ['end1', 'n2'], 'yes', 'n3', 'nc', 'f1',
      'n5', 'n6', 'n7', 'n7n', ['end2', 'n7'], 'n7n', 'n5', 'n6',
      'n7', 'n8', ['c2', 'n3'], 'oc', 'f2', 'n8', 'c2',
    ],
    fbox2: [
      'c1', 'n9', 'b1', 'b2', 'b2n', ['b3', 'b2'], 'b3', 'b4', 'b5',
      'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
    ],
    fbox3: [
      'c2b', 'w1', 'w2', 'w3', 'w4', ['c1b', 'w4'],
      'a1', 'a2', 'a3', 'pay', 'fin',
    ],
  };
  const normalize = (step) => typeof step === 'string' || step.autoReturn === undefined
    ? step.id || step
    : [step.id, step.autoReturn];
  Object.entries(expected).forEach(([boxId, steps]) => {
    assert.deepEqual(FLOW_PLAYBACK[boxId].map(normalize), steps);
    assert.ok(Object.isFrozen(FLOW_PLAYBACK[boxId]));
    FLOW_PLAYBACK[boxId].forEach((step) => assert.ok(Object.isFrozen(step)));
  });
  assert.ok(Object.isFrozen(FLOW_PLAYBACK));
});

test('advances current and visited classes in sequence order', () => {
  const { controller, documentRef } = createFixture();
  controller.advance('fbox1');
  assert.ok(node(documentRef, 'fbox1', 'st').classList.contains('flow-current'));
  controller.advance('fbox1');
  assert.ok(node(documentRef, 'fbox1', 'st').classList.contains('flow-visited'));
  assert.ok(!node(documentRef, 'fbox1', 'st').classList.contains('flow-current'));
  assert.ok(node(documentRef, 'fbox1', 'n1').classList.contains('flow-current'));
});

test('locks endpoints and automatically returns to their configured target', () => {
  const { controller, documentRef, timers } = createFixture();
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(controller.getState('fbox1').locked, true);
  assert.equal(controller.advance('fbox1').status, 'locked');
  assert.equal(timers.pendingCount(), 1);
  assert.ok(node(documentRef, 'fbox1', 'end1').classList.contains('flow-current'));
  assert.ok(!node(documentRef, 'fbox1', 'end1').classList.contains('flow-visited'));
  timers.runNext();
  assert.equal(controller.getState('fbox1').currentId, 'n2');
  assert.equal(controller.getState('fbox1').locked, false);
  for (const nodeId of ['no', 'end1']) {
    assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-current'), false);
    assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-visited'), false);
  }
  assert.equal(node(documentRef, 'fbox1', 'n2').classList.contains('flow-current'), true);
  assert.equal(node(documentRef, 'fbox1', 'n1').classList.contains('flow-visited'), true);
});

test('reset cancels a locked return and restores every node to its original state', () => {
  const { controller, documentRef, timers } = createFixture();
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(controller.getState('fbox1').locked, true);

  assert.deepEqual(controller.reset('fbox1'), { status: 'reset' });

  assert.deepEqual(controller.getState('fbox1'), {
    index: -1, currentId: null, locked: false, timerId: null,
  });
  assert.equal(timers.pendingCount(), 0);
  documentRef.querySelectorAll('#fbox1 [data-node-id]').forEach((routeNode) => {
    assert.equal(routeNode.classList.contains('flow-current'), false);
    assert.equal(routeNode.classList.contains('flow-visited'), false);
  });
});

test('startAt clears prior state and selects the first duplicate occurrence', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 4);

  assert.deepEqual(controller.startAt('fbox1', 'n5'), {
    status: 'started', id: 'n5', index: 9,
  });

  assert.equal(controller.getState('fbox1').index, 9);
  assert.equal(controller.getState('fbox1').currentId, 'n5');
  documentRef.querySelectorAll('#fbox1 [data-node-id]').forEach((routeNode) => {
    assert.equal(routeNode.classList.contains('flow-visited'), false);
    assert.equal(routeNode.classList.contains('flow-current'), routeNode.dataset.nodeId === 'n5');
  });
});

test('startAt schedules the first automatic occurrence and rejects unknown nodes', () => {
  const { controller, timers } = createFixture();
  assert.deepEqual(controller.startAt('fbox2', 'b3'), {
    status: 'started', id: 'b3', index: 5,
  });
  assert.equal(controller.getState('fbox2').locked, true);
  assert.equal(timers.pendingCount(), 1);
  assert.equal(controller.startAt('fbox2', 'missing').status, 'inactive');
});

test('automatic returns clear only nodes after their decision', () => {
  const { controller, documentRef, timers } = createFixture();

  advanceTimes(controller, 'fbox1', 5); timers.runNext();
  advanceTimes(controller, 'fbox1', 9); timers.runNext();
  for (const nodeId of ['n7n', 'end2']) {
    assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-visited'), false);
  }

  advanceTimes(controller, 'fbox1', 6); timers.runNext();
  for (const nodeId of ['nc', 'f1', 'n5', 'n6', 'n7', 'n7n', 'end2', 'n8', 'c2']) {
    const routeNode = node(documentRef, 'fbox1', nodeId);
    assert.equal(routeNode.classList.contains('flow-current'), false);
    assert.equal(routeNode.classList.contains('flow-visited'), false);
  }
  assert.equal(node(documentRef, 'fbox1', 'n3').classList.contains('flow-current'), true);

  advanceTimes(controller, 'fbox2', 6); timers.runNext();
  for (const nodeId of ['b2n', 'b3']) {
    assert.equal(node(documentRef, 'fbox2', nodeId).classList.contains('flow-visited'), false);
  }

  advanceTimes(controller, 'fbox3', 6); timers.runNext();
  assert.equal(node(documentRef, 'fbox3', 'c1b').classList.contains('flow-visited'), false);
});

test('keeps page state independent and binds only active left-pointer presses', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  assert.equal(documentRef.listeners.get('pointerdown').capture, true);
  documentRef.setActiveSlide('s8');
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox2').currentId, 'c1');
  documentRef.dispatchPointer({ button: 2 });
  assert.equal(controller.getState('fbox2').index, 0);
  documentRef.dispatchPointer({ button: 0, target: new FakeResetTarget('fbox1') });
  assert.equal(controller.getState('fbox2').index, 0);
  assert.equal(controller.getState('fbox2').currentId, 'c1');
  documentRef.setActiveSlide('s7');
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox1').currentId, 'st');
  assert.equal(controller.getState('fbox2').currentId, 'c1');
});

test('active flow forward advances, locks, completes, and ignores normal slides', () => {
  const { controller, documentRef, timers } = createFixture();

  documentRef.setActiveSlide('s1');
  assert.deepEqual(controller.advanceActiveUntilComplete(), { status: 'inactive' });

  documentRef.setActiveSlide('s9');
  assert.equal(controller.advanceActiveUntilComplete().status, 'advanced');
  advanceTimes(controller, 'fbox3', 5);
  assert.deepEqual(controller.advanceActiveUntilComplete(), {
    status: 'locked', boxId: 'fbox3', id: 'c1b',
  });
  timers.runNext();
  advanceTimes(controller, 'fbox3', 5);
  assert.deepEqual(controller.advanceActiveUntilComplete(), {
    status: 'complete', boxId: 'fbox3', id: 'fin',
  });
  assert.equal(controller.getState('fbox3').currentId, 'fin');

  documentRef.setActiveSlide('s8');
  advanceTimes(controller, 'fbox2', 6);
  assert.deepEqual(controller.advanceActiveUntilComplete(), {
    status: 'locked', boxId: 'fbox2', id: 'b3',
  });
});

test('navigation controls do not advance an active flow through global pointers', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s9');

  documentRef.dispatchPointer({ button: 0, target: new FakeFlowNavigationTarget() });

  assert.equal(controller.getState('fbox3').index, -1);
});

test('global pointer prioritizes reset and node targets without double advancement', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s8');

  const b3 = node(documentRef, 'fbox2', 'b3');
  documentRef.dispatchPointer({ button: 0, target: new FakeChildTarget(b3) });
  assert.equal(controller.getState('fbox2').index, 5);
  assert.equal(controller.getState('fbox2').currentId, 'b3');

  documentRef.dispatchPointer({ button: 0, target: new FakeResetTarget('fbox2') });
  assert.equal(controller.getState('fbox2').index, -1);
  assert.equal(controller.getState('fbox2').currentId, null);

  documentRef.dispatchPointer({ button: 0, target: null });
  assert.equal(controller.getState('fbox2').currentId, 'c1');
});

test('supports all automatic returns, completion restart, reset, and unknown boxes', () => {
  const { controller, documentRef, timers } = createFixture();
  advanceTimes(controller, 'fbox1', 5); timers.runNext();
  advanceTimes(controller, 'fbox1', 9); timers.runNext();
  advanceTimes(controller, 'fbox1', 6); timers.runNext();
  advanceTimes(controller, 'fbox2', 6); timers.runNext();
  advanceTimes(controller, 'fbox3', 6); timers.runNext();
  assert.equal(controller.getState('fbox1').currentId, 'n3');
  assert.equal(controller.getState('fbox2').currentId, 'b2');
  assert.equal(controller.getState('fbox3').currentId, 'w4');
  advanceTimes(controller, 'fbox1', 4);
  const restarted = controller.advance('fbox1');
  assert.equal(restarted.restarted, true);
  assert.equal(controller.getState('fbox1').currentId, 'st');
  documentRef.querySelectorAll('#fbox1 [data-node-id]').forEach((routeNode) => {
    if (routeNode !== node(documentRef, 'fbox1', 'st')) {
      assert.ok(!routeNode.classList.contains('flow-current'));
      assert.ok(!routeNode.classList.contains('flow-visited'));
    }
  });
  controller.reset('fbox1');
  assert.deepEqual(controller.getState('fbox1'), { index: -1, currentId: null, locked: false, timerId: null });
  assert.equal(controller.advance('missing').status, 'inactive');
});

test('destroy clears timers and removes the capture listener', () => {
  const { controller, documentRef, timers } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s7');
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(timers.pendingCount(), 1);
  controller.destroy();
  assert.equal(timers.pendingCount(), 0);
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox1').currentId, 'end1');
});

test('uses browser-global timer defaults when only documentRef is supplied', () => {
  const documentRef = new FakeDocument(FLOW_PLAYBACK);
  const timers = createFakeTimers();
  const browserGlobal = {
    document: documentRef,
    setTimeout: timers.setTimer,
    clearTimeout: timers.clearTimer,
  };
  const source = readFileSync(require.resolve('../flow-interactions.js'), 'utf8');

  vm.runInNewContext(source, browserGlobal);
  const controller = browserGlobal.FongchiFlowInteractions.createFlowInteractionController({ documentRef });
  advanceTimes(controller, 'fbox1', 5);

  assert.equal(controller.getState('fbox1').currentId, 'end1');
  assert.equal(timers.pendingCount(), 1);
});
