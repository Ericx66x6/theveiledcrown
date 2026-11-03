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
  emit(type, x, y, detail = 0) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0, detail });
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
