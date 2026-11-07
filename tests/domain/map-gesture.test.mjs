import test from 'node:test';
import assert from 'node:assert/strict';
import { guardedMarker } from '../../client/map-gesture.js';
class Marker extends EventTarget {
  constructor() {
    super();
    this.captured = new Set();
    this.classList = { add() {}, remove() {} };
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
  emit(type, x, y, detail = 0, pointerId = 1) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId, button: 0, detail });
    this.dispatchEvent(event);
  }
}
test('gesto do mapa: arraste simples não altera posição; duplo toque com arraste libera salvamento', () => {
  const e = new Marker(),
    abort = new AbortController();
  let moves = 0,
    saves = 0,
    starts = 0;
  guardedMarker(e, {
    editable: () => true,
    onTap() {},
    onStart() {
      starts++;
    },
    onMove() {
      moves++;
    },
    onEnd(moved) {
      if (moved) saves++;
    },
    onCancel() {},
    signal: abort.signal
  });
  e.emit('pointerdown', 10, 10);
  e.emit('pointermove', 80, 80);
  e.emit('pointerup', 80, 80);
  assert.equal(moves, 0);
  assert.equal(saves, 0);
  assert.equal(starts, 0);
  e.emit('pointerdown', 10, 10);
  e.emit('pointerup', 10, 10);
  e.emit('pointerdown', 10, 10, 2);
  e.emit('pointermove', 80, 80);
  e.emit('pointerup', 80, 80, 2);
  assert.equal(moves, 1);
  assert.equal(saves, 1);
  assert.equal(starts, 1);
  abort.abort();
});
test('gesto do mapa: marcador de outro jogador continua sem arraste, mesmo com dois toques', () => {
  const e = new Marker(),
    abort = new AbortController();
  let moves = 0,
    saves = 0;
  guardedMarker(e, {
    editable: () => false,
    onTap() {},
    onStart() {},
    onMove() {
      moves++;
    },
    onEnd() {
      saves++;
    },
    onCancel() {},
    signal: abort.signal
  });
  e.emit('pointerdown', 10, 10);
  e.emit('pointerup', 10, 10);
  e.emit('pointerdown', 10, 10, 2);
  e.emit('pointermove', 80, 80);
  e.emit('pointerup', 80, 80, 2);
  assert.equal(moves, 0);
  assert.equal(saves, 0);
  abort.abort();
});
test('gesto do mapa: outro dedo não substitui o arraste; cancelamento não salva', () => {
  const e = new Marker(),
    abort = new AbortController();
  let saves = 0,
    cancels = 0,
    moves = 0;
  guardedMarker(e, {
    editable: () => true,
    onTap() {},
    onMove() {
      moves++;
    },
    onEnd() {
      saves++;
    },
    onCancel() {
      cancels++;
    },
    signal: abort.signal
  });
  e.emit('pointerdown', 10, 10, 2);
  e.emit('pointerdown', 100, 100, 2, 2);
  e.emit('pointermove', 200, 200, 2, 2);
  e.emit('pointerup', 200, 200, 2, 2);
  assert.equal(moves, 0);
  assert.equal(saves, 0);
  e.emit('pointermove', 50, 50);
  e.emit('pointercancel', 50, 50);
  assert.equal(moves, 1);
  assert.equal(cancels, 1);
  assert.equal(saves, 0);
  abort.abort();
});
test('gesto do mapa: soltar usa o destino final; perder captura ou sair da página cancela', () => {
  const e = new Marker(),
    abort = new AbortController();
  let last,
    saves = 0,
    cancels = 0;
  guardedMarker(e, {
    editable: () => true,
    onTap() {},
    onMove(event) {
      last = event.clientX;
    },
    onEnd(moved) {
      if (moved) saves++;
    },
    onCancel() {
      cancels++;
    },
    signal: abort.signal
  });
  e.emit('pointerdown', 10, 10, 2);
  e.emit('pointermove', 30, 30);
  e.emit('pointerup', 50, 50);
  assert.equal(last, 50);
  assert.equal(saves, 1);
  e.emit('pointerdown', 50, 50, 2);
  e.emit('lostpointercapture', 50, 50);
  assert.equal(cancels, 1);
  e.emit('pointerdown', 50, 50, 2);
  abort.abort();
  assert.equal(cancels, 2);
  assert.equal(saves, 1);
});
