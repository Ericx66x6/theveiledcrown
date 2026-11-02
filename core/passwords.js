import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
const encode = new TextEncoder();
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (value) => Uint8Array.from(value.match(/../g), (c) => parseInt(c, 16));
async function derive(password, salt, iterations) {
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', encode.encode(password), 'PBKDF2', false, [
      'deriveBits'
    ]);
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        256
      )
    );
  }
  return pbkdf2Async(sha256, encode.encode(password), salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 12
  });
}
export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues)
    throw new Error('Use um navegador atual para criar senhas locais.');
  crypto.getRandomValues(salt);
  return {
    algorithm: 'pbkdf2-sha256',
    iterations: 210000,
    salt: hex(salt),
    hash: hex(await derive(password, salt, 210000))
  };
}
export async function checkPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || !stored) return false;
  const actual = await derive(password, unhex(stored.salt), stored.iterations);
  const expected = unhex(stored.hash);
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ (expected[i] || 0);
  return diff === 0;
}
