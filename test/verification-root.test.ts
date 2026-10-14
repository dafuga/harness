import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { verificationTarget } from './verification-targets';

const root = resolve(import.meta.dirname, '..');
const scenario = 'history-fixture-integrity';
const file = 'test/seed-attacher.test.ts';

test('root scenario uses only its declared test states at the actual repository root', () => {
	const target = verificationTarget(scenario, 'vitest', file, root);
	expect(target.package).toBe('root');
	expect(target.states).toEqual(['history-equivalence', 'seed-isolation']);
	expect(target.states).not.toContain('changed-parent-log');
});

test('a root scenario refuses foreign checkouts and package directories', () => {
	for (const cwd of [
		'/tmp/another-harness',
		'/fixture/packages/root',
		resolve(root, 'packages/reports')
	])
		expect(() => verificationTarget(scenario, 'vitest', file, cwd)).toThrow('Unknown');
});

test('a root scenario refuses unknown runners and files', () => {
	for (const [runner, target] of [
		['playwright', file],
		['vitest', 'test/unknown.test.ts']
	])
		expect(() => verificationTarget(scenario, runner, target, root)).toThrow('Unknown');
});
