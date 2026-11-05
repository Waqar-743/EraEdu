import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import postcss from 'postcss';
import tailwind from '../tailwind.config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sourceFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(absolute) : /\.(?:tsx?|css)$/.test(entry.name) ? [absolute] : [];
});

test('every marketing stylesheet selector is contained by the homepage', () => {
  for (const file of ['homepage.css', 'illustrations.css']) {
    const css = postcss.parse(read(`src/components/landing/${file}`));
    css.walkRules(rule => {
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule' && parent.name.endsWith('keyframes')) return;
      }
      for (const selector of rule.selectors) {
        assert.match(selector.trim(), /^\.home-page(?=$|[\s.:\[>+~#])/, `${file}: ${selector}`);
      }
    });
  }
});

test('no other page or shared component imports homepage artwork or styles', () => {
  for (const file of sourceFiles(path.join(root, 'src'))) {
    const relative = path.relative(path.join(root, 'src'), file).replaceAll(path.sep, '/');
    if (relative.startsWith('components/landing/') || relative === 'pages/LandingPage.tsx') continue;
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /(?:from|import)\s*['"][^'"]*(?:components\/landing|landing\/|LandingPage\.css)/, relative);
    assert.doesNotMatch(text, /dashboard-learning-flow|dashboard-open-book|dashboard-teal|student-teal|\bqs-art\b|\bfont-display\b/, relative);
    assert.doesNotMatch(text, /Plus Jakarta Sans|Clash Display|Satoshi/, relative);
    assert.doesNotMatch(text, /radial-gradient|linear-gradient|bg-gradient-to-/, relative);
  }
});

test('application defaults do not inherit the marketing font or green palette', () => {
  assert.doesNotMatch(read('index.html'), /fonts\.googleapis|fonts\.gstatic|api\.fontshare/);
  assert.doesNotMatch(read('src/index.css'), /radial-gradient|linear-gradient|data:image\/svg|--color-primary-|#047857|#10B981/i);
  assert.match(tailwind.theme.extend.fontFamily.sans.join(','), /ui-sans-serif/);
  assert.doesNotMatch(tailwind.theme.extend.fontFamily.sans.join(','), /Jakarta|Clash|Satoshi/);
  assert.doesNotMatch(tailwind.theme.extend.colors.primary[700], /4 120 87/);
  assert.match(read('src/components/landing/homepage.css'), /--color-primary-700:\s*4 120 87/);
  assert.match(read('src/components/landing/homepage.css'), /--font-display:\s*"Clash Display"/);
});

test('the homepage keeps its illustrations and exclusive brand component', () => {
  const homepage = read('src/pages/LandingPage.tsx');
  assert.match(homepage, /components\/landing\/HomepageBrand/);
  assert.match(homepage, /components\/landing\/Illustrations/);
  assert.match(homepage, /className="home-page\b/);
  assert.match(read('src/App.tsx'), /<Route path="\/" element=\{<LandingPage \/>\}/);
  assert.doesNotMatch(read('src/components/shared/Brand.tsx'), /<svg|<img|gradient/);
});
