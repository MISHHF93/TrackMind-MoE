import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCommandLanguageCoverage, commandLanguageRequirementKeywords, trackMindCommandLanguage } from '../dist/shell/design-language.js';
import { domainScreens } from '../dist/shell/domains.js';
import { navItems } from '../dist/shell/navigation.js';

test('TrackMind command language metadata declares required design and governance requirements', () => {
  const serialized = JSON.stringify(trackMindCommandLanguage).toLowerCase();

  assert.deepEqual([...commandLanguageRequirementKeywords], ['spacing','grid','hierarchy','accessibility','safety','evidence','approval','audit','twin']);
  for (const keyword of commandLanguageRequirementKeywords) {
    assert.ok(serialized.includes(keyword), `missing command language requirement ${keyword}`);
  }

  assert.ok(trackMindCommandLanguage.principles.length >= 5);
  assert.ok(trackMindCommandLanguage.componentCategories.some((category) => category.id === 'artifact-api-hub'));
  assert.ok(trackMindCommandLanguage.accessibilityRequirements.some((requirement) => /accessible name/i.test(requirement)));
  assert.ok(trackMindCommandLanguage.accessibilityRequirements.some((requirement) => /keyboard/i.test(requirement)));
  assert.ok(trackMindCommandLanguage.accessibilityRequirements.some((requirement) => /focus/i.test(requirement)));
  assert.ok(trackMindCommandLanguage.accessibilityRequirements.some((requirement) => /role=/i.test(requirement)));
  assert.ok(trackMindCommandLanguage.safetyApprovalUiRules.every((rule) => /approval|evidence|audit|disabled|read-only|advisory|protected|backend/i.test(rule)));
});

test('TrackMind command language covers every first-class workspace from navigation and domain screens', () => {
  const audit = auditCommandLanguageCoverage();
  const navIds = navItems.map((item) => item.id);
  const screenIds = domainScreens.map((screen) => screen.id);
  const languageIds = trackMindCommandLanguage.workspaceRequirements.map((workspace) => workspace.id);

  assert.deepEqual(audit, {
    workspaceIds: languageIds,
    missingInNavigation: [],
    missingInDomainScreens: [],
    missingInCommandLanguage: [],
    missingRequirementKeywords: [],
  });
  assert.deepEqual(new Set(languageIds), new Set(navIds));
  assert.deepEqual(new Set(languageIds), new Set(screenIds));
  assert.equal(languageIds.length, 22);
  assert.ok(languageIds.includes('api-hub'));
});

test('workspace command language requirements keep layout, accessibility, safety, evidence, approval, audit, and twin posture explicit', () => {
  const screenById = new Map(domainScreens.map((screen) => [screen.id, screen]));

  for (const workspace of trackMindCommandLanguage.workspaceRequirements) {
    const screen = screenById.get(workspace.id);
    assert.ok(screen, `${workspace.id} missing screen`);
    for (const requirement of ['spacing','grid','hierarchy','accessibility']) {
      assert.ok(workspace.layoutRequirements.includes(requirement), `${workspace.id} missing layout requirement ${requirement}`);
    }
    for (const requirement of ['safety','evidence','audit','twin']) {
      assert.ok(workspace.safetyRequirements.includes(requirement), `${workspace.id} missing safety requirement ${requirement}`);
    }
    if (screen.stateChangingActions.length > 0) {
      assert.ok(workspace.safetyRequirements.includes('approval'), `${workspace.id} state-changing workspace must require approval metadata`);
    }
  }

  const apiHub = trackMindCommandLanguage.workspaceRequirements.find((workspace) => workspace.id === 'api-hub');
  assert.ok(apiHub);
  assert.ok(apiHub.deepLinks.includes('/api-hub/license-policy'));
  assert.equal(screenById.get('api-hub').stateChangingActions.length, 0);
});
