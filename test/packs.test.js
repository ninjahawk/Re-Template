import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listPacks, loadPack, validatePack } from '../src/packs.js';

test('ships the launch brand packs', () => {
  const packs = listPacks();
  for (const id of ['primer', 'material', 'polaris', 'carbon', 'editorial', 'terminal']) {
    assert.ok(packs.includes(id), `missing pack ${id}`);
  }
});

test('every shipped pack is valid and declares its provenance', () => {
  for (const id of listPacks()) {
    const p = loadPack(id);
    assert.equal(p.id, id);
    assert.ok(['open-source', 'inspired-by'].includes(p.kind));
    assert.ok(p.license, `${id} must declare a license`);
    assert.ok(p.tokens.color.roles.accent, `${id} must define an accent`);
  }
});

test('unknown pack fails loudly', () => {
  assert.throws(() => loadPack('stripe-exact-clone'), /unknown pack/);
});

test('rejects a pack that smuggles in an identity asset', () => {
  const bad = {
    id: 'bad', kind: 'inspired-by', license: 'MIT',
    tokens: { font: { sans: 'x' }, color: { roles: { accent: '#000', canvas: '#fff', fg: '#000' } },
      logo: 'data:image/png;base64,AAAA' },
  };
  assert.throws(() => validatePack(bad, 'bad'), /identity asset/);
});

test('rejects a structurally incomplete pack', () => {
  assert.throws(() => validatePack({ id: 'x', kind: 'open-source' }, 'x'), /missing "tokens"/);
});
