import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	defaultVerifyConfig,
	verifyConfigFile,
	verifyConfigSchema
} from '../../src/core/verifyTypes';

const whole =
	'bun x playwright test --config src/configs/development-tooling/shellPlaywrightConfig.ts';
const parse = (profiles: object, checks: object[]) =>
	verifyConfigSchema.safeParse({ ...defaultVerifyConfig, profiles, checks });
const issues = (result: ReturnType<typeof parse>) =>
	result.success
		? []
		: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

test('a profile command without {target} that several checks inherit is rejected by name', () => {
	const result = parse({ shell: { command: whole } }, [
		{ path: 'tests/e2e/one.spec.ts', profile: 'shell' },
		{ path: 'tests/e2e/two.spec.ts', profile: 'shell' }
	]);
	expect(issues(result)).toEqual([
		'profiles.shell.command: Profile "shell" has no {target} in its command and 2 checks inherit it, ' +
			'so each would run the same command. Add {target} or give each check its own command.'
	]);
});

test('commands that legitimately have no {target} stay valid', () => {
	// One check alone may inherit a whole-configuration command: nothing is ambiguous.
	const alone = parse({ shell: { command: whole } }, [
		{ path: 'tests/e2e/one.spec.ts', profile: 'shell' }
	]);
	// Checks that override the profile's command only take its time limit.
	const overridden = parse({ shell: { command: whole, timeoutMs: 90_000 } }, [
		{ path: 'tests/e2e/one.spec.ts', profile: 'shell', command: `${whole} one.spec.ts` },
		{ path: 'tests/e2e/two.spec.ts', profile: 'shell', command: `${whole} two.spec.ts` }
	]);
	// A profile with no command, and one nobody uses, say nothing about targets.
	const timeoutOnly = parse({ slow: { timeoutMs: 90_000 }, unused: { command: whole } }, [
		{ path: 'tests/e2e/one.spec.ts', profile: 'slow', command: whole },
		{ path: 'tests/e2e/two.spec.ts', profile: 'slow', command: whole }
	]);
	// A check-local command needs no {target} either, as before profiles existed.
	const local = parse({}, [{ path: 'tests/e2e/one.spec.ts', command: whole }]);
	expect([alone, overridden, timeoutOnly, local].map(issues)).toEqual([[], [], [], []]);
	expect(overridden.success && overridden.data.checks.map((check) => check.timeoutMs)).toEqual([
		90_000, 90_000
	]);
});

test("this repository's own configuration passes the rule", () => {
	const own = JSON.parse(readFileSync(verifyConfigFile, 'utf8')) as unknown;
	expect(issues(verifyConfigSchema.safeParse(own))).toEqual([]);
});
