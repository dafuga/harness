import { expect, test } from 'vitest';
import { join, resolve } from 'node:path';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { scenarioManifestSchema } from '../src/core/unitTypes';
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

/** Every active wrapper keeps an independent, reviewed test-to-state registration. */
function registeredTargets() {
	const directory = join(root, 'specification/scenarios');
	return readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.sort()
		.flatMap((name) => {
			const scenario = scenarioManifestSchema.parse(
				JSON.parse(readFileSync(join(directory, name), 'utf8'))
			);
			return scenario.tests.flatMap((check) => {
				const file = /verification-output\.ts\s+vitest\s+(\S+)\s*$/.exec(check.target)?.[1];
				if (check.runner !== 'command' || !file) return [];
				const cwd = resolve(root, check.cwd ?? '.');
				return [
					{
						cwd,
						target: verificationTarget(scenario.id, 'vitest', file, cwd),
						states: scenario.states.map((state) => state.id)
					}
				];
			});
		});
}

test('registered evidence names match the actual collected tests before broad verification', async () => {
	const targets = registeredTargets();
	const directory = await mkdtemp(join(tmpdir(), 'harness-permitted-tests-'));
	try {
		let index = 0;
		for (const cwd of new Set(targets.map((entry) => entry.cwd))) {
			const group = targets.filter((entry) => entry.cwd === cwd);
			const report = join(directory, `${index++}.json`);
			const files = [...new Set(group.map((entry) => entry.target.target))];
			// The list CLI hides skipped native tests; collect declarations without executing them.
			const script = `
				import { createVitest } from 'vitest/node';
				import { writeFileSync } from 'node:fs';
				const ctx = await createVitest('test', { watch: false, run: true });
				try {
					const result = await ctx.collect(JSON.parse(process.env.HARNESS_COLLECT_FILES));
					if (result.unhandledErrors.length) throw new AggregateError(result.unhandledErrors);
					const tests = result.testModules.flatMap(file =>
						[...file.children.allTests()].map(test => ({ name: test.fullName, file: file.moduleId })));
					writeFileSync(process.env.HARNESS_COLLECT_REPORT, JSON.stringify(tests));
				} finally { await ctx.close(); }
			`;
			const collected = spawnSync('node', ['--input-type=module', '--eval', script], {
				cwd,
				encoding: 'utf8',
				env: {
					...process.env,
					HARNESS_COLLECT_FILES: JSON.stringify(files),
					HARNESS_COLLECT_REPORT: report
				},
				timeout: 60_000
			});
			expect(collected.status, collected.stdout + collected.stderr).toBe(0);
			const actual = JSON.parse(await readFile(report, 'utf8')) as Array<{
				name: string;
				file: string;
			}>;
			for (const { target, states } of group) {
				const path = realpathSync(resolve(cwd, target.target));
				const names = actual
					.filter((item) => realpathSync(item.file) === path)
					.map((item) => item.name);
				expect(names.sort(), `${target.scenario}:${target.target}`).toEqual(
					Object.keys(target.tests).sort()
				);
				expect(states).toEqual(expect.arrayContaining(target.states));
			}
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}, 180_000);
