(function attachFlowInteractions(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FongchiFlowInteractions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApi(root) {
  'use strict';

  const FLOW_BY_SLIDE = Object.freeze({ s7: 'fbox1', s8: 'fbox2', s9: 'fbox3' });
  const freezeSteps = (steps) => Object.freeze(steps.map((step) => {
    const normalized = typeof step === 'string' ? { id: step } : { ...step };
    if (normalized.resumeVia) normalized.resumeVia = Object.freeze([...normalized.resumeVia]);
    return Object.freeze(normalized);
  }));
  const FLOW_PLAYBACK = Object.freeze({
    fbox1: freezeSteps([
      'st', 'n1', 'n2', 'no', 'end1',
      { id: 'yes', resumeFrom: 'n2' }, 'n3', 'nc', 'f1', 'n5', 'n6', 'n7', 'n7n', 'end2',
      { id: 'n7n', resumeFrom: 'n7' }, 'n5', 'n6', 'n7', 'n8', 'c2',
      { id: 'oc', resumeFrom: 'n3' }, 'f2', 'n8', 'c2',
    ]),
    fbox2: freezeSteps([
      'c1', 'n9', 'b1', 'b2', 'b2n', 'b3',
      { id: 'b4', resumeFrom: 'b2', resumeVia: ['b3'] }, 'b5', 'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
    ]),
    fbox3: freezeSteps([
      'c2b', 'w1', 'w2', 'w3', 'w4', 'c1b', { id: 'a1', resumeFrom: 'w4' },
      'a2', 'a3', 'pay', 'fin',
    ]),
  });

  function createFlowInteractionController(options) {
    const settings = options || {};
    const documentRef = settings.documentRef || root.document;
    let states = Object.freeze(Object.fromEntries(
      Object.keys(FLOW_PLAYBACK).map((boxId) => [boxId, Object.freeze({ index: -1, currentId: null })]),
    ));
    let boundTarget = null;
    let pointerHandler = null;

    function replaceState(boxId, state) {
      states = Object.freeze({ ...states, [boxId]: Object.freeze(state) });
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

    function visiblePathAt(boxId, index) {
      const visiblePath = [];
      FLOW_PLAYBACK[boxId].slice(0, index + 1).forEach((step) => {
        if (step.resumeFrom) {
          const resumeIndex = visiblePath.lastIndexOf(step.resumeFrom);
          visiblePath.splice(resumeIndex + 1);
          (step.resumeVia || []).forEach((nodeId) => visiblePath.push(nodeId));
        }
        visiblePath.push(step.id);
      });
      return visiblePath;
    }

    function renderAtIndex(boxId, index) {
      clearClasses(boxId);
      const visiblePath = visiblePathAt(boxId, index);
      const currentId = visiblePath.at(-1) || null;
      new Set(visiblePath.slice(0, -1)).forEach((nodeId) => {
        findNode(boxId, nodeId)?.classList.add('flow-visited');
      });
      const currentNode = findNode(boxId, currentId);
      currentNode?.classList.remove('flow-visited');
      currentNode?.classList.add('flow-current');
      return replaceState(boxId, { index, currentId });
    }

    function reset(boxId) {
      if (!FLOW_PLAYBACK[boxId]) return { status: 'inactive' };
      renderAtIndex(boxId, -1);
      return { status: 'reset' };
    }

    function advance(boxId) {
      const steps = FLOW_PLAYBACK[boxId];
      if (!steps) return { status: 'inactive' };
      const state = states[boxId];
      if (state.index >= steps.length - 1) return { status: 'complete', boxId, id: state.currentId };
      const nextState = renderAtIndex(boxId, state.index + 1);
      return { status: 'advanced', boxId, id: nextState.currentId };
    }

    function retreat(boxId) {
      const steps = FLOW_PLAYBACK[boxId];
      if (!steps) return { status: 'inactive' };
      const state = states[boxId];
      if (state.index <= 0) return { status: 'start-boundary', boxId, id: state.currentId };
      const nextState = renderAtIndex(boxId, state.index - 1);
      return { status: 'retreated', boxId, id: nextState.currentId };
    }

    function activeBoxId() {
      const activeSlide = documentRef?.querySelector('.slide.active');
      return activeSlide && FLOW_BY_SLIDE[activeSlide.id];
    }

    function advanceActive() {
      const boxId = activeBoxId();
      return boxId ? advance(boxId) : { status: 'inactive' };
    }

    function advanceActiveUntilComplete() {
      const boxId = activeBoxId();
      return boxId ? advance(boxId) : { status: 'inactive' };
    }

    function retreatActiveUntilStart() {
      const boxId = activeBoxId();
      return boxId ? retreat(boxId) : { status: 'inactive' };
    }

    function resetActive() {
      const boxId = activeBoxId();
      return boxId ? reset(boxId) : { status: 'inactive' };
    }

    function startAt(boxId, nodeId) {
      const steps = FLOW_PLAYBACK[boxId];
      if (!steps) return { status: 'inactive' };
      const index = steps.findIndex((step) => step.id === nodeId);
      if (index < 0 || !findNode(boxId, nodeId)) return { status: 'inactive' };
      renderAtIndex(boxId, index);
      return { status: 'started', id: nodeId, index };
    }

    function bindGlobalPointer(eventTarget) {
      if (boundTarget) return { status: 'bound' };
      boundTarget = eventTarget || documentRef;
      pointerHandler = (event) => {
        if (event.button !== 0) return;
        const boxId = activeBoxId();
        if (!boxId) return;
        if (event.target?.closest?.('[data-flow-navigation]')) return;

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
      boundTarget?.removeEventListener('pointerdown', pointerHandler, true);
      boundTarget = null;
      pointerHandler = null;
    }

    return {
      advance,
      retreat,
      advanceActive,
      advanceActiveUntilComplete,
      retreatActiveUntilStart,
      reset,
      resetActive,
      startAt,
      bindGlobalPointer,
      getState,
      destroy,
    };
  }

  return { FLOW_BY_SLIDE, FLOW_PLAYBACK, createFlowInteractionController };
});
