import { expect, test } from 'vitest';
import { verificationTarget } from './verification-targets';
import scenario from '../specification/scenarios/game-authoring.json' with { type: 'json' };

const cwd = '/fixture/packages/desktop';
const stateIds = new Set(scenario.states.map((state) => state.id));

test('every game-authoring check is the runner, a runner and a single test file, and nothing else', () => {
	for (const item of scenario.tests) {
		const tokens = item.target.split(/\s+/);
		expect(tokens.slice(0, 3)).toEqual(['bun', '../../test/verification-output.ts', 'playwright']);
		expect(tokens, `${item.id} takes exactly one test file`).toHaveLength(4);
	}
});

test('every game-authoring check resolves to a registered scope with known states', () => {
	for (const item of scenario.tests) {
		const file = item.target.split(/\s+/)[3];
		const target = verificationTarget('game-authoring', 'playwright', file, cwd);
		expect(target.states.length, `${file} maps to states`).toBeGreaterThan(0);
		for (const state of target.states) expect(stateIds.has(state), state).toBe(true);
	}
});

test('the level lifecycle and authoring specs are scoped to their own states', () => {
	const authoring = verificationTarget(
		'game-authoring',
		'playwright',
		'tests/e2e/game-authoring.spec.ts',
		cwd
	);
	const lifecycle = verificationTarget(
		'game-authoring',
		'playwright',
		'tests/e2e/game-level-lifecycle.spec.ts',
		cwd
	);
	expect(authoring.states).toContain('2d-play');
	expect(authoring.states).not.toContain('level-review-2d');
	expect(lifecycle.states).toContain('level-review-2d');
	expect(lifecycle.states).not.toContain('2d-play');
});

test('an unregistered game spec still fails closed', () => {
	expect(() =>
		verificationTarget('game-authoring', 'playwright', 'tests/e2e/game-other.spec.ts', cwd)
	).toThrow('Unknown');
});
