import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { verifyConfigSchema } from '../src/core/verifyTypes';
import { scenarioManifestSchema, type ScenarioManifest } from '../src/core/unitTypes';
import { verificationTarget } from './verification-targets';
import { taskProfile } from './support/taskProfiles';

interface Manifest {
	owns: { source: string[] };
}

/** Every file under a directory of this repository, as repository paths. */
function under(directory: string): string[] {
	return readdirSync(directory, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

/** True when a declared path, a file or a directory with a trailing slash, covers `path`. */
function covers(declared: string, path: string): boolean {
	const directory = declared.endsWith('/') ? declared : `${declared}/`;
	return path === declared || path.startsWith(directory);
}

test('this repository requires profiling and declares no source as something a check may write', async () => {
	const declared = JSON.parse(readFileSync('harness.verify.json', 'utf8'));
	const config = verifyConfigSchema.parse(declared);
	expect(config.performanceRequired, 'normal repository verification requires profiling').toBe(1);
	await taskProfile('function.verify-types', 'parse-committed-verification-config', () =>
		verifyConfigSchema.parse(declared)
	);
	const manifests = under('specification/units').map(
		(file) => JSON.parse(readFileSync(file, 'utf8')) as Manifest
	);
	const source = manifests.flatMap((unit) => unit.owns.source);
	expect(source.length).toBeGreaterThan(500);
	// Loop state, scenarios, measurements and the registry itself are source too.
	const kept = [...source, ...under('specification'), ...under('test'), 'harness.verify.json'];
	expect(kept).toContain('specification/loops/agentic-self-hosting/loop.json');
	for (const declared of [...config.outputs, ...config.link]) {
		const covered = kept.filter((path) => covers(declared, path));
		expect([declared, covered]).toEqual([declared, []]);
	}
	// A build that is identified is compiled output, and it is declared as an output.
	for (const build of config.builds) {
		expect(config.outputs.some((declared) => covers(declared, `${build.directory}/x`))).toBe(true);
	}
});

function registeredStates(scenario: ScenarioManifest) {
	const states = new Set<string>(),
		gaps: string[] = [];
	let wrappers = 0;
	for (const check of scenario.tests) {
		if (!check.target.includes('test/verification-output.ts')) continue;
		wrappers++;
		const match = /verification-output\.ts (vitest|playwright) (?:--config \S+ )?(\S+)$/.exec(
			check.target
		);
		if (!match) {
			gaps.push(`${scenario.id}: unsupported wrapper command ${check.id}`);
			continue;
		}
		try {
			const scope = verificationTarget(
				scenario.id,
				match[1],
				match[2],
				join(process.cwd(), check.cwd ?? '.')
			);
			for (const state of scope.states) states.add(state);
		} catch (error) {
			gaps.push(`${scenario.id}: ${check.id}: ${String(error)}`);
		}
	}
	return { states, gaps, wrappers };
}

function registrationProblems(scenario: ScenarioManifest): string[] {
	const { states, gaps, wrappers } = registeredStates(scenario);
	return [
		...gaps,
		...scenario.evidence.flatMap((slot) => {
			const visual =
				slot.kind === 'screenshot' && !slot.build
					? [`${scenario.id}: ${slot.id}: missing compiled build binding`]
					: [];
			const output =
				wrappers === scenario.tests.length && slot.kind === 'output' && slot.required
					? slot.states
							.filter((state) => !states.has(state))
							.map((state) => `${scenario.id}: ${state}: no registered output producer`)
					: [];
			return [...visual, ...output];
		})
	];
}

test('registered scenario wrappers cover their output states and visual build identities', () => {
	const gaps = under('specification/scenarios')
		.filter((path) => path.endsWith('.json'))
		.flatMap((file) =>
			registrationProblems(scenarioManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8'))))
		);
	expect(gaps).toEqual([]);
});
