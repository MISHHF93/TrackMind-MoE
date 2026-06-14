import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_DENSITY_LEVEL,
  DEFAULT_THEME_MODE,
  cssVariableForTokenPath,
  dashboardThemeCss,
  densityLevels,
  flattenTokenEntries,
  requiredSemanticTokenPaths,
  semanticTokenValue,
  semanticTokensByMode,
  themeModes,
} from '../dist/theme/tokens.js';

test('core theme modes expose all required semantic tokens', () => {
  for (const mode of themeModes) {
    const entriesByPath = new Map(flattenTokenEntries(semanticTokensByMode[mode.id]).map((entry) => [entry.path, entry]));
    for (const path of requiredSemanticTokenPaths) {
      const entry = entriesByPath.get(path);
      assert.ok(entry, `${mode.id} is missing ${path}`);
      assert.equal(entry.variable, cssVariableForTokenPath(path));
      assert.ok(dashboardThemeCss.includes(`${entry.variable}: ${entry.value};`), `${entry.variable} missing from generated CSS`);
    }
  }
});

test('theme switching metadata covers dark light and high contrast modes', () => {
  assert.equal(DEFAULT_THEME_MODE, 'command-center-dark');
  assert.deepEqual(themeModes.map((mode) => mode.id), ['command-center-dark', 'light', 'high-contrast']);
  assert.ok(themeModes.find((mode) => mode.id === 'command-center-dark')?.selectors.includes(':root'));
  assert.ok(dashboardThemeCss.includes('[data-theme="light"]'));
  assert.ok(dashboardThemeCss.includes('[data-theme="high-contrast"]'));
});

test('density levels generate control and card spacing tokens', () => {
  assert.equal(DEFAULT_DENSITY_LEVEL, 'comfortable');
  assert.deepEqual(densityLevels.map((density) => density.id), ['compact', 'comfortable', 'spacious']);
  for (const density of densityLevels) {
    assert.ok(dashboardThemeCss.includes(`[data-density="${density.id}"]`));
    assert.ok(dashboardThemeCss.includes(`--tm-density-control-height: ${density.tokens.controlHeight};`));
    assert.ok(dashboardThemeCss.includes(`--tm-density-card-padding: ${density.tokens.cardPadding};`));
  }
});

test('high contrast mode prioritizes explicit contrast tokens', () => {
  assert.equal(semanticTokenValue('high-contrast', 'background.app'), '#000000');
  assert.equal(semanticTokenValue('high-contrast', 'border.subtle'), '#ffffff');
  assert.equal(semanticTokenValue('high-contrast', 'text.primary'), '#ffffff');
  assert.equal(semanticTokenValue('high-contrast', 'status.warning'), '#fde047');
});

test('shared visual components avoid hardcoded status color drift', () => {
  const source = readFileSync(new URL('../src/components/nexus-ui.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
  assert.ok(source.includes('data-risk'));
  assert.ok(source.includes('data-tone'));
  assert.ok(source.includes('data-status'));
});
