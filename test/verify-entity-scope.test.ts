import { test } from 'vitest';
import { expect } from './verificationExpect';
import {
	scopedCheck,
	scopedScenarios,
	scopeFailure
} from '../src/workflows/verification-evidence/run-verify/verification-service/entityScope';
import { scopedContext } from '../src/workflows/verification-evidence/run-verify/scopedVerify';
import type { ScenarioManifest } from '../src/core/development-tooling/unitTypes';
import type { PlannedCheck } from '../src/utils/verification-evidence/verifyPlan';

const badge = 'reports.component.status-badge';
const catalog = {
	id: 'catalog',
	units: [badge, 'reports.component.modal'],
	states: [
		{ id: 'badge', units: [badge] },
		{ id: 'badge-failed', units: [badge] },
		{ id: 'modal', units: ['reports.component.modal'] }
	],
	viewports: [{ id: 'desktop' }, { id: 'mobile' }],
	evidence: [{ id: 'screens', kind: 'screenshot', states: ['badge', 'badge-failed', 'modal'] }],
	tests: []
} as unknown as ScenarioManifest;
const other = { ...catalog, id: 'other', units: ['x'], states: [], evidence: [] };

test('a scoped run keeps only the scenarios and states that show the entity', () => {
	const [scoped, ...rest] = scopedScenarios([catalog, other], badge);
	expect(rest).toEqual([]);
	expect(scoped.units).toEqual([badge]);
	expect(scoped.states.map((state) => state.id)).toEqual(['badge', 'badge-failed']);
	expect(scoped.evidence?.[0].states).toEqual(['badge', 'badge-failed']);
	expect(scoped.viewports).toHaveLength(2);
});

test('an entity no scenario covers is refused', () => {
	expect(() => scopedScenarios([catalog], 'reports.component.none')).toThrow('No scenario covers');
});

test('a scoped Playwright check greps the tests named after the entity', () => {
	const check = { runner: 'command', command: 'bun x playwright test a.spec.ts' } as PlannedCheck;
	const grep = new RegExp(scopedCheck(check, badge).command.split("--grep '")[1].slice(0, -1));
	expect(grep.test('a.spec.ts > reports.component.status-badge at desktop')).toBe(true);
	expect(grep.test('reports.component.status-badge:failed at mobile')).toBe(true);
	expect(grep.test('reports.component.status-badge-x at desktop')).toBe(false);
	expect(grep.test('reports.component.modal at desktop')).toBe(false);
	const vitest = { runner: 'vitest', command: 'vitest run a.test.ts' } as PlannedCheck;
	expect(scopedCheck(vitest, badge)).toBe(vitest);
});

test('a scoped Playwright check preserves a scenario selector', () => {
	const check = {
		runner: 'command',
		command: "bun x playwright test preview.spec.ts --grep 'APIs catalog'"
	} as PlannedCheck;
	expect(scopedCheck(check, badge)).toBe(check);
});

test('a scoped record states it is partial', () => {
	expect(scopeFailure(badge)).toContain('partial and never a full pass');
});

test('a scoped run does not reopen repository-wide gates from an empty base', () => {
	const base = { name: 'empty' };
	const head = { name: 'head' };
	const context = scopedContext({ base, head } as never);
	expect(context.base).toBe(head);
});
