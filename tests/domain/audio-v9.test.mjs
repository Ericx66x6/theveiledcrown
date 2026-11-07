import test from 'node:test';
import assert from 'node:assert/strict';
test('v9: efeitos e trilha são independentes; aba oculta e silêncio encerram os sons agendados', async () => {
  const callbacks = new Map(),
    nodes = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime() {}
  });
  const node = () => ({
    gain: param(),
    frequency: param(),
    Q: param(),
    detune: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    connect(n) {
      return n;
    },
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
    disconnect() {}
  });
  class AudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.destination = node();
    }
    createGain() {
      return node();
    }
    createDynamicsCompressor() {
      return node();
    }
    createOscillator() {
      const n = node();
      nodes.push(n);
      return n;
    }
    createBiquadFilter() {
      return node();
    }
    createBuffer(ch, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      const n = node();
      nodes.push(n);
      return n;
    }
    resume() {
      return Promise.resolve();
    }
  }
  globalThis.document = {
    hidden: false,
    querySelectorAll: () => [],
    addEventListener: (name, callback) => callbacks.set(name, callback)
  };
  globalThis.window = { AudioContext };
  try {
    const audio = await import('../../client/audio.js');
    audio.installSound();
    callbacks.get('pointerdown')();
    audio.configureSound({ audio_enabled: false, music_enabled: false });
    const before = nodes.length;
    audio.playSound('purchase');
    assert.equal(nodes.length, before);
    audio.configureSound({ audio_enabled: false, music_enabled: true });
    assert.ok(nodes.length > before, 'trilha pode tocar com efeitos desativados');
    const musicCount = nodes.length;
    audio.playSound('dice');
    assert.equal(nodes.length, musicCount);
    document.hidden = true;
    callbacks.get('visibilitychange')();
    assert.ok(
      nodes.every((n) => n.stopped),
      'ocultar a aba encerra sons da trilha já agendados'
    );
    document.hidden = false;
    audio.configureSound({ audio_enabled: true, music_enabled: false });
    const quiet = nodes.length;
    audio.playSound('tick');
    assert.ok(nodes.length > quiet, 'efeitos funcionam sem trilha');
    audio.configureSound({ audio_enabled: false, music_enabled: false });
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
