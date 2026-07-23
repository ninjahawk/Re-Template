#!/usr/bin/env node
// re-template — reskin AI-slop websites to a real design language.
//
//   re-template score  <file|dir>              rate the slop, itemize the tells
//   re-template apply  --pack <id> <file>       reskin to a brand pack
//   re-template diff   --pack <id> <file>       show what would change
//   re-template packs                           list available brand packs

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { analyze, level } from '../src/slop.js';
import { apply } from '../src/apply.js';
import { extract, reformat } from '../src/reformat.js';
import { loadPack, listPacks } from '../src/packs.js';

const C = (n) => (s) => (process.stdout.isTTY === false && !process.env.FORCE_COLOR ? s : `\x1b[${n}m${s}\x1b[0m`);
const bold = C(1), dim = C(2), red = C(31), green = C(32), yellow = C(33), blue = C(34), cyan = C(36), gray = C(90);

function collectHtml(target) {
  const st = statSync(target);
  if (st.isFile()) return [target];
  return readdirSync(target)
    .filter((f) => ['.html', '.htm'].includes(extname(f).toLowerCase()))
    .map((f) => join(target, f));
}

function scoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const color = score >= 70 ? red : score >= 40 ? yellow : green;
  return color('█'.repeat(filled)) + gray('░'.repeat(width - filled));
}

function cmdScore(target) {
  const files = collectHtml(target);
  if (!files.length) return fail(`no HTML files found at ${target}`);
  for (const file of files) {
    const { score, level: lvl, findings } = analyze(readFileSync(file, 'utf8'));
    const tag = lvl === 'clean' ? green(lvl) : lvl === 'heavy' ? red(lvl) : yellow(lvl);
    console.log('');
    console.log(`${bold('Re-Template')} ${gray('· slop report for')} ${cyan(file)}`);
    console.log('');
    console.log(`  ${bold('Slop score')}  ${bold(String(score).padStart(2))} ${gray('/ 100')}   ${scoreBar(score)}  (${tag})`);
    console.log('');
    if (!findings.length) {
      console.log(`  ${green('No slop tells found. Looks intentional.')}`);
    } else {
      console.log(dim('  Tells found:'));
      for (const f of findings) {
        const times = f.count > 1 ? gray(`×${f.count}`.padStart(4)) : '    ';
        console.log(`  ${yellow('●')} ${f.label.padEnd(42)} ${times}  ${red('+' + f.points)}`);
      }
      console.log('');
      console.log(gray(`  Fix it:  re-template apply --pack primer ${file}`));
    }
    console.log('');
  }
}

function cmdApply(target, packId, { write }) {
  if (!packId) return fail('apply needs --pack <id>. Try: re-template packs');
  const pack = loadPack(packId);
  const files = collectHtml(target);
  if (!files.length) return fail(`no HTML files found at ${target}`);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const before = analyze(src).score;
    const { html, changes } = apply(src, pack);
    const after = analyze(html).score;
    const out = write ? file : file.replace(/\.html?$/i, '') + `.${pack.id}.html`;
    writeFileSync(out, html);
    console.log('');
    console.log(`${bold('Re-Template')} ${gray('· reskinned')} ${cyan(basename(file))} ${gray('→')} ${bold(pack.name)}`);
    for (const ch of changes) console.log(`  ${green('✓')} ${ch.label} ${ch.count > 1 ? gray(`(×${ch.count})`) : ''}`);
    console.log('');
    console.log(`  slop ${red(String(before))} ${gray('→')} ${green(String(after))}   ${gray('written to')} ${cyan(out)}`);
    console.log('');
  }
}

function cmdDiff(target, packId) {
  if (!packId) return fail('diff needs --pack <id>.');
  const pack = loadPack(packId);
  for (const file of collectHtml(target)) {
    const src = readFileSync(file, 'utf8');
    const { changes } = apply(src, pack);
    const before = analyze(src);
    const after = analyze(apply(src, pack).html);
    console.log('');
    console.log(`${bold(basename(file))} ${gray('→')} ${bold(pack.name)}   ${red('slop ' + before.score)} ${gray('→')} ${green(after.score)}`);
    for (const ch of changes) console.log(`  ${blue('~')} ${ch.label}${ch.count > 1 ? gray(` (×${ch.count})`) : ''}`);
    console.log('');
  }
}

function cmdReformat(target, packId, { write }) {
  const pack = loadPack(packId || 'poke500');
  const files = collectHtml(target);
  if (!files.length) return fail(`no HTML files found at ${target}`);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const model = extract(src);
    const html = reformat(src, pack);
    const out = write ? file : file.replace(/\.html?$/i, '') + `.reformat.html`;
    writeFileSync(out, html);
    console.log('');
    console.log(`${bold('Re-Template')} ${gray('· reformatted')} ${cyan(basename(file))} ${gray('→')} ${bold(pack.name)} ${gray('structure')}`);
    console.log(`  ${green('✓')} brand ${gray('·')} ${model.brand}`);
    console.log(`  ${green('✓')} headline ${gray('·')} ${model.headline.slice(0, 52)}`);
    console.log(`  ${green('✓')} ${model.nav.length} nav item(s), ${model.caps.length} capabilit${model.caps.length === 1 ? 'y' : 'ies'} → table`);
    console.log('');
    console.log(`  ${gray('re-cast into a')} ${bold(pack.name)} ${gray('layout')}   ${gray('written to')} ${cyan(out)}`);
    console.log('');
  }
}

function cmdPacks() {
  const ids = listPacks();
  console.log('');
  console.log(bold('Available brand packs:'));
  for (const id of ids) {
    const p = loadPack(id);
    const kind = p.kind === 'open-source' ? green(p.kind) : yellow(p.kind);
    console.log(`  ${cyan(id.padEnd(10))} ${p.name.padEnd(16)} ${gray(p.basedOn)}  [${kind}]`);
  }
  console.log('');
}

function help() {
  console.log(`
${bold('re-template')} ${gray('· reskin AI-slop websites to a real design language')}

  ${cyan('re-template score')}  <file|dir>              rate the slop, itemize the tells
  ${cyan('re-template apply')}    --pack <id> <file> [-w]  reskin to a brand pack (-w writes in place)
  ${cyan('re-template reformat')} --pack <id> <file> [-w]  re-cast the *structure* into the author's layout
  ${cyan('re-template diff')}     --pack <id> <file>       show what would change
  ${cyan('re-template packs')}                             list available brand packs

${gray('apply reskins the paint; reformat rebuilds the skeleton in the author\'s hand.')}
`);
}

function fail(msg) { console.error(red('error: ') + msg); process.exitCode = 1; }

function main(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const rest = args.slice(1);
  const packId = valFor(rest, '--pack') || valFor(rest, '-p');
  const write = rest.includes('--write') || rest.includes('-w');
  const positional = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '--pack' && rest[i - 1] !== '-p');
  const target = positional[0];

  try {
    switch (cmd) {
      case 'score': return target ? cmdScore(target) : fail('score needs a <file|dir>');
      case 'apply': return target ? cmdApply(target, packId, { write }) : fail('apply needs a <file>');
      case 'reformat': return target ? cmdReformat(target, packId, { write }) : fail('reformat needs a <file>');
      case 'diff': return target ? cmdDiff(target, packId) : fail('diff needs a <file>');
      case 'packs': return cmdPacks();
      case undefined: case '-h': case '--help': case 'help': return help();
      default: return fail(`unknown command "${cmd}". Try: re-template help`);
    }
  } catch (err) {
    fail(err.message);
  }
}

function valFor(arr, flag) {
  const i = arr.indexOf(flag);
  return i !== -1 && arr[i + 1] ? arr[i + 1] : null;
}

main(process.argv);
