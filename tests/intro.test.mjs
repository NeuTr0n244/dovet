import test from 'node:test';
import assert from 'node:assert/strict';
import { mountIntro } from '../src/intro.js';

function mockGlobals(values) {
  const originals = new Map();
  for (const [name, value] of Object.entries(values)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

const forbiddenDOM = new Proxy({}, {
  get() { assert.fail('A bypassed introduction must not access or modify the DOM.'); },
});

test('reduced motion bypasses the introduction, including an explicit replay', async () => {
  let completed = 0;
  const restore = mockGlobals({
    document: forbiddenDOM,
    sessionStorage: { getItem: () => null },
    matchMedia: query => {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: true };
    },
  });
  try {
    const cleanup = mountIntro({ replay: true, onComplete: () => completed++ });
    assert.equal(typeof cleanup, 'function');
    assert.equal(completed, 0, 'Completion is deferred until after mount returns.');
    await Promise.resolve();
    assert.equal(completed, 1);
    cleanup();
    cleanup();
    assert.equal(completed, 1, 'Cleanup must not complete the intro again.');
  } finally { restore(); }
});

test('an introduction already seen this session opens the site without creating an overlay', async () => {
  let completed = 0;
  const restore = mockGlobals({
    document: forbiddenDOM,
    sessionStorage: {
      getItem(key) {
        assert.equal(key, 'dovet.intro.seen.v1');
        return 'yes';
      },
    },
    matchMedia: () => ({ matches: false }),
  });
  try {
    const cleanup = mountIntro({ onComplete: () => completed++ });
    assert.equal(typeof cleanup, 'function');
    assert.equal(completed, 0);
    await Promise.resolve();
    assert.equal(completed, 1);
    cleanup();
    assert.equal(completed, 1);
  } finally { restore(); }
});
