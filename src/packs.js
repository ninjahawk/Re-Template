// packs.js — load and validate brand packs.
//
// A pack is a JSON file of design tokens + rules describing a *design system*,
// never a company's identity. See CONTRIBUTING.md for the format and the
// "systems, not identities" constraint that governs what a pack may contain.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PACKS_DIR = join(HERE, '..', 'packs');

export function listPacks(dir = PACKS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'pack.json')))
    .map((d) => d.name)
    .sort();
}

export function loadPack(id, dir = PACKS_DIR) {
  const file = join(dir, id, 'pack.json');
  if (!existsSync(file)) {
    const have = listPacks(dir);
    throw new Error(`unknown pack "${id}". Available: ${have.join(', ') || '(none)'}`);
  }
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  validatePack(pack, id);
  return pack;
}

// A pack must describe a system, not ship an identity. We reject the obvious
// identity carriers so a bad pack fails loudly instead of shipping a logo.
export function validatePack(pack, id) {
  const problems = [];
  if (!pack || typeof pack !== 'object') problems.push('not an object');
  if (!pack.tokens) problems.push('missing "tokens"');
  if (!pack.tokens?.color?.roles) problems.push('missing tokens.color.roles');
  if (!pack.tokens?.font?.sans) problems.push('missing tokens.font.sans');
  if (!['open-source', 'inspired-by'].includes(pack.kind)) {
    problems.push('kind must be "open-source" or "inspired-by"');
  }
  const banned = /logo|wordmark|trademark|\.svg|\.png|base64/i;
  if (banned.test(JSON.stringify(pack.tokens))) {
    problems.push('tokens contain an identity asset (logo/wordmark/embedded image) — packs are systems, not identities');
  }
  if (problems.length) {
    throw new Error(`pack "${id}" is invalid: ${problems.join('; ')}`);
  }
  return true;
}
