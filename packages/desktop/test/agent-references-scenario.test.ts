import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import scenario from '../../../specification/scenarios/agent-references.json' with { type: 'json' };
import playwright from '../playwright.config';
import { verificationTarget } from '../../../test/verification-targets';

/**
 * The agent-references scenario runs what it names with the configs the package actually uses:
 * one existing file per check, each state with required evidence, each screenshot state taken
 * by its producer, its units exactly those whose manifests name it, and the recorder accepts
 * every check for the states its evidence proves.
 */
const desktop = resolve(import.meta.dirname, '..');
const units = resolve(desktop, '../../specification/units');
const checks = scenario.tests.map((item) => {
	const [, , runner, file, ...rest] = item.target.split(' ');
	return { id: item.id, runner, file, rest, cwd: item.cwd };
});

test('every check runs one existing file through the runner and config of its kind', () => {
	for (const check of checks) {
		expect(check.rest, check.id).toEqual([]);
		expect(check.cwd, check.id).toBe('packages/desktop');
		expect(existsSync(resolve(desktop, check.file)), check.file).toBe(true);
		if (check.runner === 'playwright')
			expect(check.file.startsWith(`${playwright.testDir}/`), check.file).toBe(true);
		else expect([check.runner, /^test\/.+\.test\.ts$/.test(check.file)]).toEqual(['vitest', true]);
	}
	expect(scenario.tests[0].target).toMatch(/^bun \.\.\/\.\.\/test\/verification-output\.ts /);
	expect(playwright.use?.viewport).toEqual({ width: 1440, height: 900 });
});

test('every state has required evidence and every screenshot state is taken by its producer', () => {
	const producer = readFileSync(resolve(desktop, 'tests/e2e/reference-views.spec.ts'), 'utf8');
	for (const state of scenario.states) {
		const proof = scenario.evidence.filter((item) => item.states.includes(state.id));
		expect(
			proof.some((item) => item.required),
			state.id
		).toBe(true);
	}
	for (const shot of scenario.evidence.filter((item) => item.kind === 'screenshot'))
		for (const state of shot.states)
			expect(producer, state).toContain(`capture(page, info, '${state}')`);
	expect(scenario.viewports.find((item) => item.id === 'desktop')).toMatchObject({
		...playwright.use?.viewport
	});
});

test('the scenario names exactly the units whose manifests name it', () => {
	const naming = readdirSync(units)
		.map((file) => JSON.parse(readFileSync(resolve(units, file), 'utf8')))
		.filter((unit) => unit.scenarios?.includes(scenario.id))
		.map((unit) => unit.id)
		.sort();
	expect(naming).toEqual([...scenario.units].sort());
});

test('the recorder accepts every check from this package for the states its evidence proves', () => {
	const declared = scenario.states.map((state) => state.id);
	const proven = (kind: string) =>
		scenario.evidence.filter((item) => item.kind === kind).flatMap((item) => item.states);
	const allowed = { vitest: proven('assertions'), playwright: proven('screenshot') };
	const reached = new Set<string>();
	for (const check of checks) {
		const target = verificationTarget(scenario.id, check.runner, check.file, process.cwd());
		expect(target.states.length, check.file).toBeGreaterThan(0);
		for (const state of target.states) {
			expect(allowed[target.runner], `${check.file}: ${state}`).toContain(state);
			reached.add(state);
		}
		if (target.runner === 'vitest') expect(Object.keys(target.tests), check.file).not.toEqual([]);
	}
	expect([...reached].sort()).toEqual([...declared].sort());
});
