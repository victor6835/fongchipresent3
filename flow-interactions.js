(function attachFlowInteractions(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FongchiFlowInteractions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApi(root) {
  'use strict';

  const AUTO_RETURN_MS = 700;
  const FLOW_BY_SLIDE = Object.freeze({ s7: 'fbox1', s8: 'fbox2', s9: 'fbox3' });
  const freezeSteps = (steps) => Object.freeze(steps.map((step) => Object.freeze(
    typeof step === 'string' ? { id: step } : { ...step },
  )));
  const FLOW_PLAYBACK = Object.freeze({
    fbox1: freezeSteps([
      'st', 'n1', 'n2', 'no', { id: 'end1', autoReturn: 'n2' },
      'yes', 'n3', 'nc', 'f1', 'n5', 'n6', 'n7', 'n7n',
      { id: 'end2', autoReturn: 'n7' }, 'n7n', 'n5', 'n6', 'n7', 'n8',
      { id: 'c2', autoReturn: 'n3' }, 'oc', 'f2', 'n8', 'c2',
    ]),
    fbox2: freezeSteps([
      'c1', 'n9', 'b1', 'b2', 'b2n', { id: 'b3', autoReturn: 'b2' },
      'b3', 'b4', 'b5', 'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
    ]),
    fbox3: freezeSteps([
      'c2b', 'w1', 'w2', 'w3', 'w4', { id: 'c1b', autoReturn: 'w4' },
      'a1', 'a2', 'a3', 'pay', 'fin',
    ]),
  });

  function createFlowInteractionController(options) {
    const settings = options || {};
    const documentRef = settings.documentRef || root.document;
    const setTimer = settings.setTimer || root.setTimeout.bind(root);
    const clearTimer = settings.clearTimer || root.clearTimeout.bind(root);
    const autoReturnMs = settings.autoReturnMs === undefined ? AUTO_RETURN_MS : settings.autoReturnMs;
    let states = Object.freeze(Object.fromEntries(
      Object.keys(FLOW_PLAYBACK).map((boxId) => [boxId, Object.freeze({
        index: -1, currentId: null, locked: false, timerId: null,
      })]),
    ));
    let boundTarget = null;
    let pointerHandler = null;

    function replaceState(boxId, patch) {
      states = Object.freeze({
        ...states,
        [boxId]: Object.freeze({ ...states[boxId], ...patch }),
      });
      return states[boxId];
    }

    function findNode(boxId, nodeId) {
      return documentRef?.querySelector(`#${boxId} [data-node-id="${nodeId}"]`) || null;
    }

    function clearClasses(boxId) {
      documentRef?.querySelectorAll(`#${boxId} [data-node-id]`).forEach((node) => {
        node.classList.remove('flow-current', 'flow-visited');
      });
    }

    function clearTimerFor(boxId) {
      const state = states[boxId];
      if (state.timerId !== null) clearTimer(state.timerId);
      replaceState(boxId, { timerId: null });
    }

    function reset(boxId) {
      if (!FLOW_PLAYBACK[boxId]) return { status: 'inactive' };
      clearTimerFor(boxId);
      clearClasses(boxId);
      replaceState(boxId, { index: -1, currentId: null, locked: false });
      return { status: 'reset' };
    }

    function scheduleAutoReturn(boxId, step) {
      if (!step.autoReturn) return states[boxId];
      const timerId = setTimer(() => returnFromEndpoint(boxId, step.autoReturn), autoReturnMs);
      return replaceState(boxId, { locked: true, timerId });
    }

    function clearStepRange(boxId, fromIndex, throughIndex) {
      const ids = new Set(
        FLOW_PLAYBACK[boxId].slice(fromIndex, throughIndex + 1).map((step) => step.id),
      );
      ids.forEach((nodeId) => {
        findNode(boxId, nodeId)?.classList.remove('flow-current', 'flow-visited');
      });
    }

    function returnFromEndpoint(boxId, returnId) {
      const state = states[boxId];
      const steps = FLOW_PLAYBACK[boxId];
      let decisionIndex = state.index - 1;
      while (decisionIndex >= 0 && steps[decisionIndex].id !== returnId) decisionIndex -= 1;
      clearStepRange(boxId, Math.max(0, decisionIndex + 1), state.index);
      const returnNode = findNode(boxId, returnId);
      returnNode?.classList.remove('flow-visited');
      returnNode?.classList.add('flow-current');
      replaceState(boxId, { currentId: returnId, locked: false, timerId: null });
    }

    function advance(boxId) {
      const steps = FLOW_PLAYBACK[boxId];
      if (!steps) return { status: 'inactive' };
      const state = states[boxId];
      if (state.locked) return { status: 'locked' };
      let index = state.index + 1;
      let restarted = false;
      if (index >= steps.length) {
        reset(boxId);
        index = 0;
        restarted = true;
      }
      const previousNode = restarted ? null : findNode(boxId, state.currentId);
      const step = steps[index];
      const nextNode = findNode(boxId, step.id);
      previousNode?.classList.add('flow-visited');
      previousNode?.classList.remove('flow-current');
      nextNode?.classList.remove('flow-visited');
      nextNode?.classList.add('flow-current');
      replaceState(boxId, { index, currentId: step.id });
      scheduleAutoReturn(boxId, step);
      return { status: 'advanced', id: step.id, restarted };
    }

    function advanceActive() {
      const activeSlide = documentRef?.querySelector('.slide.active');
      const boxId = activeSlide && FLOW_BY_SLIDE[activeSlide.id];
      return boxId ? advance(boxId) : { status: 'inactive' };
    }

    function startAt(boxId, nodeId) {
      const steps = FLOW_PLAYBACK[boxId];
      if (!steps) return { status: 'inactive' };
      const index = steps.findIndex((step) => step.id === nodeId);
      const nextNode = index >= 0 ? findNode(boxId, nodeId) : null;
      if (index < 0 || !nextNode) return { status: 'inactive' };

      clearTimerFor(boxId);
      clearClasses(boxId);
      nextNode.classList.add('flow-current');
      replaceState(boxId, {
        index, currentId: nodeId, locked: false, timerId: null,
      });
      scheduleAutoReturn(boxId, steps[index]);
      return { status: 'started', id: nodeId, index };
    }

    function bindGlobalPointer(eventTarget) {
      if (boundTarget) return { status: 'bound' };
      boundTarget = eventTarget || documentRef;
      pointerHandler = (event) => {
        if (event.button !== 0) return;
        const activeSlide = documentRef?.querySelector('.slide.active');
        const boxId = activeSlide && FLOW_BY_SLIDE[activeSlide.id];
        if (!boxId) return;

        const resetTarget = event.target?.closest?.('[data-flow-reset]');
        if (resetTarget) {
          if (resetTarget.dataset.flowReset === boxId) reset(boxId);
          return;
        }

        const nodeTarget = event.target?.closest?.(`#${boxId} [data-node-id]`);
        if (nodeTarget) {
          startAt(boxId, nodeTarget.dataset.nodeId);
          return;
        }

        advance(boxId);
      };
      boundTarget?.addEventListener('pointerdown', pointerHandler, true);
      return { status: 'bound' };
    }

    function getState(boxId) {
      return states[boxId];
    }

    function destroy() {
      Object.keys(FLOW_PLAYBACK).forEach((boxId) => clearTimerFor(boxId));
      boundTarget?.removeEventListener('pointerdown', pointerHandler, true);
      boundTarget = null;
      pointerHandler = null;
    }

    return { advance, advanceActive, startAt, bindGlobalPointer, reset, getState, destroy };
  }

  return { AUTO_RETURN_MS, FLOW_BY_SLIDE, FLOW_PLAYBACK, createFlowInteractionController };
});
