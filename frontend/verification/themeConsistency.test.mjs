import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import postcss from 'postcss';
import tailwind from '../tailwind.config.js';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(frontend, 'src');
const themePath = path.join(sourceRoot, 'theme.css');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    if (!/\.(?:css|[cm]?[jt]sx?)$/.test(entry.name)) return [];
    return [{ filename, source: await readFile(filename, 'utf8') }];
  }));
  return nested.flat();
}

const sources = await sourceFiles(sourceRoot);
const stylesheets = sources.filter(file => file.filename.endsWith('.css'))
  .map(file => ({ ...file, ast: postcss.parse(file.source, { from: file.filename }) }));
const theme = stylesheets.find(file => file.filename === themePath);
assert.ok(theme, 'The shared theme stylesheet must exist.');

const utilityKind = '(?:bg|text|border|ring(?:-offset)?|divide|from|via|to|fill|stroke|outline|decoration|shadow|accent|placeholder|caret)';
const independentPalette = '(?:blue|indigo|purple|violet|cyan|teal|accent|secondary|gray|slate|zinc|neutral)';
const decorativeUtility = new RegExp(`\\b${utilityKind}-${independentPalette}-\\d{2,3}\\b`, 'g');
const colourProperty = /(?:color|background|border|outline|shadow|fill|stroke|gradient)/i;

function location(filename, line) {
  return `${path.relative(frontend, filename).replaceAll('\\', '/')}:${line}`;
}

test('pages and components use shared brand and neutral palettes', () => {
  const violations = [];
  for (const { filename, source } of sources) {
    if (filename !== themePath && /#[\da-f]{3,8}(?![\w-])/i.test(source)) {
      violations.push(`${location(filename, 1)} hardcodes a colour outside the shared theme`);
    }
    for (const match of source.matchAll(decorativeUtility)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(`${location(filename, line)} uses ${match[0]}`);
    }
  }
  assert.deepEqual(violations, [], 'Use primary-* or ink-*; reserve status colours for meaningful states.');
});

test('font families have one source and components cannot override them inline', () => {
  const violations = [];
  for (const { filename, source } of sources) {
    if (/\bfontFamily\s*[:=]/.test(source)) violations.push(`${location(filename, 1)} declares an inline font family`);
    if (/\bfont-serif\b|\bfont-\[(?!\d+(?:\.\d+)?\]|var\(--font-)[^\]]+\]/.test(source)) {
      violations.push(`${location(filename, 1)} bypasses the shared font utilities`);
    }
  }
  for (const { filename, ast } of stylesheets) {
    if (filename === themePath) continue;
    ast.walkDecls(declaration => {
      if (/^--(?:font-|color-(?:primary|ink)-)/.test(declaration.prop)
        || (declaration.prop === 'font' && declaration.value !== 'inherit')
        || (declaration.prop === 'font-family' && !/^(?:var\(--font-[\w-]+(?:,\s*inherit)?\)|inherit)$/.test(declaration.value))) {
        violations.push(`${location(filename, declaration.source.start.line)} overrides a shared brand token or font`);
      }
    });
  }
  assert.deepEqual(violations, [], 'Define font stacks in src/theme.css and use font-sans/display/mono.');
});

test('colour rules cannot defeat component hover, focus or disabled states', () => {
  const violations = [];
  for (const { filename, ast } of stylesheets) {
    ast.walkRules(rule => {
      if (!/\[class\s*\*=/.test(rule.selector)) return;
      const affectsColour = rule.nodes?.some(node =>
        (node.type === 'decl' && colourProperty.test(node.prop))
        || (node.type === 'atrule' && node.name === 'apply' && new RegExp(utilityKind + '-').test(node.params)));
      if (affectsColour) violations.push(`${location(filename, rule.source.start.line)} uses a substring colour selector`);
    });
    ast.walkDecls(declaration => {
      if (declaration.important && colourProperty.test(declaration.prop)) {
        violations.push(`${location(filename, declaration.source.start.line)} forces ${declaration.prop} with !important`);
      }
    });
    ast.walkAtRules('apply', rule => {
      if (rule.params.includes('!important')) violations.push(`${location(filename, rule.source.start.line)} forces utility styles with !important`);
    });
  }
  const palette = `(?:primary|ink|${independentPalette}|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia)`;
  const forcedColourUtility = new RegExp(`!${utilityKind}-(?:${palette}-\\d{2,3}|white|black|transparent|current)\\b`);
  for (const { filename, source } of sources) {
    if (forcedColourUtility.test(source)) violations.push(`${location(filename, 1)} forces a colour utility`);
    if (!filename.endsWith('.css') && /\b(?:color|background(?:Color|Image)?|borderColor|outlineColor|boxShadow|fill|stroke)\s*:\s*['"][^'"]*!important/.test(source)) {
      violations.push(`${location(filename, 1)} forces an inline colour with !important`);
    }
  }
  assert.deepEqual(violations, [], 'Use explicit semantic classes and normal cascade rules; reduced-motion !important is allowed.');
});

test('Tailwind palette and font utilities resolve to shared theme variables', () => {
  const rootVariables = new Map();
  theme.ast.walkRules(':root', rule => rule.walkDecls(declaration => rootVariables.set(declaration.prop, declaration.value)));
  const colours = tailwind.theme.extend.colors;
  for (const [variable, value] of rootVariables) {
    const match = variable.match(/^--color-(primary|ink)-(\d+)$/);
    if (!match) continue;
    const [, palette, shade] = match;
    assert.ok(colours[palette]?.[shade]?.includes(`var(${variable})`), `${variable} must be available through Tailwind.`);
    assert.match(value, /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/, `${variable} must use RGB channels for opacity modifiers.`);
    assert.ok(value.split(/\s+/).every(channel => Number(channel) >= 0 && Number(channel) <= 255));
  }
  for (const palette of ['primary', 'ink']) {
    for (const [shade, value] of Object.entries(colours[palette])) {
      assert.ok(rootVariables.has(`--color-${palette}-${shade}`), `${palette}-${shade} has no shared theme value.`);
      assert.ok(value.includes('<alpha-value>'), `${palette}-${shade} must support opacity modifiers.`);
    }
  }
  for (const [family, stack] of Object.entries(tailwind.theme.extend.fontFamily)) {
    assert.deepEqual(stack, [`var(--font-${family})`], `${family} must read its stack from the theme.`);
    assert.ok(rootVariables.get(`--font-${family}`)?.length, `${family} needs a shared font stack.`);
  }
  for (const variable of rootVariables.keys()) {
    if (!variable.startsWith('--font-')) continue;
    const family = variable.slice('--font-'.length);
    assert.ok(tailwind.theme.extend.fontFamily[family], `${variable} must be available through a Tailwind font utility.`);
  }
  // Catch misspelled tokens in charts, inline SVGs, surfaces and Tailwind config.
  for (const { filename, source } of [...sources, { filename: path.join(frontend, 'tailwind.config.js'), source: JSON.stringify(tailwind.theme.extend) }]) {
    for (const match of source.matchAll(/var\((--(?:color|font|gradient)-[\w-]+)/g)) {
      assert.ok(rootVariables.has(match[1]), `${location(filename, 1)} references undefined ${match[1]}.`);
    }
    const sharedUtility = new RegExp(`\\b${utilityKind}-(primary|ink)-(\\d{1,4})\\b`, 'g');
    for (const match of source.matchAll(sharedUtility)) {
      assert.ok(colours[match[1]]?.[match[2]], `${location(filename, 1)} uses an undefined ${match[1]}-${match[2]} utility.`);
    }
  }
});

function luminance(channels) {
  const linear = channels.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test('primary button and hover tokens keep normal white text readable', () => {
  for (const shade of [700, 800]) {
    let tested = 0;
    theme.ast.walkDecls(`--color-primary-${shade}`, declaration => {
      const channels = declaration.value.split(/\s+/).map(Number);
      assert.equal(channels.length, 3);
      const contrast = 1.05 / (luminance(channels) + 0.05);
      assert.ok(contrast >= 4.5, `primary-${shade} contrast with white is ${contrast.toFixed(2)}:1; normal text requires 4.5:1.`);
      tested++;
    });
    assert.ok(tested > 0, `Missing primary-${shade} token.`);
  }
});
