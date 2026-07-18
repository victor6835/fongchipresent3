'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
    this.nodes = new Map();
    this.listeners = new Map();
    Object.entries(playback).forEach(([boxId, steps]) => {
      const ids = new Set(steps.map((step) => step.id));
      this.nodes.set(boxId, new Map([...ids].map((id) => [id, new FakeNode(id, boxId)])));
    });
    this.activeSlideId = null;
  }

  setActiveSlide(id) {
    this.activeSlideId = id;
  }

  querySelector(selector) {
    if (selector === '.slide.active') return this.activeSlideId ? { id: this.activeSlideId } : null;
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

function createFixture() {
  const documentRef = new FakeDocument(FLOW_PLAYBACK);
  const controller = createFlowInteractionController({ documentRef });
  return { controller, documentRef };
}

function node(documentRef, boxId, nodeId) {
  return documentRef.querySelector(`#${boxId} [data-node-id="${nodeId}"]`);
}

function advanceTimes(controller, boxId, count) {
  for (let index = 0; index < count; index += 1) controller.advance(boxId);
}

test('exports the exact immutable playback tables', () => {
  assert.deepEqual(FLOW_BY_SLIDE, { s7: 'fbox1', s8: 'fbox2', s9: 'fbox3' });
  const expected = {
    fbox1: [
      'st', 'n1', 'n2', 'no', 'end1',
      ['yes', 'n2'], 'n3', 'nc', 'f1', 'n5', 'n6', 'n7', 'n7n', 'end2',
      ['n7n', 'n7'], 'n5', 'n6', 'n7', 'n8', 'c2',
      ['oc', 'n3'], 'f2', 'n8', 'c2',
    ],
    fbox2: [
      'c1', 'n9', 'b1', 'b2', 'b2n', 'b3',
      ['b4', 'b2', ['b3']], 'b5', 'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
    ],
    fbox3: [
      'c2b', 'w1', 'w2', 'w3', 'w4', 'c1b', ['a1', 'w4'],
      'a2', 'a3', 'pay', 'fin',
    ],
  };
  const normalize = (step) => {
    if (!step.resumeFrom) return step.id;
    return step.resumeVia
      ? [step.id, step.resumeFrom, [...step.resumeVia]]
      : [step.id, step.resumeFrom];
  };
  Object.entries(expected).forEach(([boxId, steps]) => {
    assert.deepEqual(FLOW_PLAYBACK[boxId].map(normalize), steps);
    assert.ok(Object.isFrozen(FLOW_PLAYBACK[boxId]));
    FLOW_PLAYBACK[boxId].forEach((step) => {
      assert.ok(Object.isFrozen(step));
      if (step.resumeVia) assert.ok(Object.isFrozen(step.resumeVia));
    });
  });
  assert.ok(Object.isFrozen(FLOW_PLAYBACK));
});

test('advances current and visited classes in sequence order', () => {
  const { controller, documentRef } = createFixture();
  controller.advance('fbox1');
  assert.equal(node(documentRef, 'fbox1', 'st').classList.contains('flow-current'), true);
  controller.advance('fbox1');
  assert.equal(node(documentRef, 'fbox1', 'st').classList.contains('flow-visited'), true);
  assert.equal(node(documentRef, 'fbox1', 'st').classList.contains('flow-current'), false);
  assert.equal(node(documentRef, 'fbox1', 'n1').classList.contains('flow-current'), true);
});

test('waits at endpoints until forward input resumes the alternate branch', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(controller.getState('fbox1').currentId, 'end1');
  controller.advance('fbox1');
  assert.equal(controller.getState('fbox1').currentId, 'yes');
  assert.equal(node(documentRef, 'fbox1', 'no').classList.contains('flow-visited'), false);
  assert.equal(node(documentRef, 'fbox1', 'end1').classList.contains('flow-visited'), false);
});

test('follows the approved quote-objection loop and reverses it exactly', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 14);
  assert.equal(controller.getState('fbox1').currentId, 'end2');
  controller.advance('fbox1');
  assert.equal(controller.getState('fbox1').currentId, 'n7n');
  for (const expectedId of ['n5', 'n6', 'n7', 'n8']) {
    assert.equal(controller.advance('fbox1').id, expectedId);
  }
  for (const expectedId of ['n7', 'n6', 'n5', 'n7n', 'end2']) {
    assert.equal(controller.retreat('fbox1').id, expectedId);
  }
  assert.equal(node(documentRef, 'fbox1', 'end2').classList.contains('flow-current'), true);
});

test('page 14 clears the shortage branch and visibly advances from b3 to b4', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox2', 6);
  assert.equal(controller.getState('fbox2').currentId, 'b3');
  assert.equal(controller.advance('fbox2').id, 'b4');
  assert.equal(node(documentRef, 'fbox2', 'b2n').classList.contains('flow-visited'), false);
  assert.equal(node(documentRef, 'fbox2', 'b3').classList.contains('flow-visited'), true);
});

test('reports flow boundaries without restarting or changing state', () => {
  const { controller, documentRef } = createFixture();
  documentRef.setActiveSlide('s9');
  advanceTimes(controller, 'fbox3', FLOW_PLAYBACK.fbox3.length);
  const finalState = controller.getState('fbox3');
  assert.equal(controller.advanceActiveUntilComplete().status, 'complete');
  assert.deepEqual(controller.getState('fbox3'), finalState);
  controller.reset('fbox3');
  assert.equal(controller.retreatActiveUntilStart().status, 'start-boundary');
  controller.advance('fbox3');
  assert.equal(controller.retreatActiveUntilStart().status, 'start-boundary');
});

test('startAt selects the first duplicate occurrence and renders its visible path', () => {
  const { controller, documentRef } = createFixture();
  assert.deepEqual(controller.startAt('fbox1', 'n5'), {
    status: 'started', id: 'n5', index: 9,
  });
  assert.deepEqual(controller.getState('fbox1'), { index: 9, currentId: 'n5' });
  assert.equal(node(documentRef, 'fbox1', 'f1').classList.contains('flow-visited'), true);
  assert.equal(node(documentRef, 'fbox1', 'n5').classList.contains('flow-current'), true);
  assert.equal(controller.startAt('fbox1', 'missing').status, 'inactive');
});

test('keeps page state independent and routes only active left-pointer presses', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  assert.equal(documentRef.listeners.get('pointerdown').capture, true);
  documentRef.setActiveSlide('s8');
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox2').currentId, 'c1');
  documentRef.dispatchPointer({ button: 2 });
  assert.equal(controller.getState('fbox2').index, 0);
  documentRef.dispatchPointer({ button: 0, target: new FakeResetTarget('fbox1') });
  assert.equal(controller.getState('fbox2').currentId, 'c1');
  documentRef.setActiveSlide('s7');
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox1').currentId, 'st');
});

test('global pointer prioritizes navigation, reset, and direct node selection', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s8');
  documentRef.dispatchPointer({ button: 0, target: new FakeFlowNavigationTarget() });
  assert.equal(controller.getState('fbox2').index, -1);

  const b3 = node(documentRef, 'fbox2', 'b3');
  documentRef.dispatchPointer({ button: 0, target: new FakeChildTarget(b3) });
  assert.equal(controller.getState('fbox2').index, 5);
  documentRef.dispatchPointer({ button: 0, target: new FakeResetTarget('fbox2') });
  assert.deepEqual(controller.getState('fbox2'), { index: -1, currentId: null });
});

test('completed background pointers stay complete and destroy removes routing', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s9');
  advanceTimes(controller, 'fbox3', FLOW_PLAYBACK.fbox3.length);
  documentRef.dispatchPointer({ button: 0 });
  assert.deepEqual(controller.getState('fbox3'), {
    index: FLOW_PLAYBACK.fbox3.length - 1, currentId: 'fin',
  });
  controller.destroy();
  documentRef.dispatchPointer({ button: 0 });
  assert.equal(controller.getState('fbox3').currentId, 'fin');
});

test('reports inactive results for unknown boxes and normal slides', () => {
  const { controller, documentRef } = createFixture();
  documentRef.setActiveSlide('s1');
  assert.deepEqual(controller.advanceActiveUntilComplete(), { status: 'inactive' });
  assert.deepEqual(controller.retreatActiveUntilStart(), { status: 'inactive' });
  assert.deepEqual(controller.resetActive(), { status: 'inactive' });
  assert.deepEqual(controller.advance('missing'), { status: 'inactive' });
  assert.deepEqual(controller.retreat('missing'), { status: 'inactive' });
  assert.deepEqual(controller.reset('missing'), { status: 'inactive' });
});
