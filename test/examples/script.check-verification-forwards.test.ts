import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { checkVerificationForwards } from '../../scripts/check-verification-forwards';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * checkVerificationForwards is called as the script calls it, with a repository root. Each case
 * writes a temporary project folder (a null value in a tree is a folder), runs the check on it and
 * records the registry, the files it was given and what the check returned or threw. Each folder is
 * removed afterwards.
 */

type Tree = Record<string, string | null>;
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const registryPath = 'scripts/verification-forward-registry.json';
const uid = 'u_example01';
const forward = 'src/utils/verification-evidence/verifyPlan.ts';
const nested = 'src/workflows/run-verify/verification-service/verifyPlan.ts';
const target = 'src/workflows/verification-evidence/run-verify/verification-service/verifyPlan.ts';
const legacy = 'src/utils/verification-evidence/legacyPlan.ts';
const fromUtils = '../../workflows/verification-evidence/run-verify/verification-service/verifyPlan';
const fromNested = '../../verification-evidence/run-verify/verification-service/verifyPlan';
const implementation = 'export function verifyPlan(): string[] { return []; }';

/** A module that opens with the UID header the check reads, then the given lines. */
const moduleWith = (id: string, ...lines: string[]) =>
	[`// @harness-uid ${id}`, ...lines, ''].join('\n');
const utilsForward = moduleWith(uid, `export * from '${fromUtils}';`);
const nestedForward = moduleWith(uid, `export * from '${fromNested}';`);
const typedForward = moduleWith(
	uid,
	'export type PlanInput = Record<string, unknown>;',
	`export * from '${fromNested}';`
);
const canonical = moduleWith(uid, implementation);
const reg = (...forwards: unknown[]) => ({ schemaVersion: 1, forwards });
const entry = (path: string, status = 'deprecated') => ({ path, target, uid, status });

/** Records the cases of one state as this unit's examples-cases evidence. */
function recordState(state: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{
			unitId: 'script.check-verification-forwards',
			symbol: 'checkVerificationForwards',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

/** Writes each path of the tree under root; a null value makes a folder instead of a file. */
function writeTree(root: string, tree: Tree): void {
	for (const [path, text] of Object.entries(tree)) {
		const full = join(root, path);
		if (text === null) mkdirSync(full, { recursive: true });
		else {
			mkdirSync(dirname(full), { recursive: true });
			writeFileSync(full, text);
		}
	}
}

/** Runs the check on a new temporary project folder holding the tree; the folder is removed. */
function checkProject(tree: Tree): Promise<string[]> {
	return withTempDir('check-verification-forwards-', (root) => {
		writeTree(root, tree);
		return checkVerificationForwards(root);
	});
}

/** A thrown error as plain values: its name and, for a system error, its code. */
function summarise(error: unknown): { name: string; code?: string } {
	const { name, code } = error as Error & { code?: string };
	return code === undefined ? { name } : { name, code };
}

/** One case: the registry and files it was given, and the issues or the error it produced. */
async function checkCase(name: string, registry: unknown, files: Tree): Promise<ExampleCase> {
	const input = { registry, files };
	const text = typeof registry === 'string' ? registry : JSON.stringify(registry);
	const tree = registry === undefined ? files : { ...files, [registryPath]: text };
	try {
		return { name, input, output: await checkProject(tree) };
	} catch (error) {
		return { name, input, error: summarise(error) };
	}
}

test('checkVerificationForwards returned no issues when every registered forward resolves to its canonical target', async () => {
	const cases = [
		await checkCase('a forward in utils re-exports its canonical target', reg(entry(forward)), {
			[forward]: utilsForward,
			[target]: canonical
		}),
		await checkCase(
			'a nested forward with a type alias re-exports its canonical target',
			reg(entry(nested)),
			{ [nested]: typedForward, [target]: canonical }
		),
		await checkCase('an empty registry with no compatibility forwards', reg(), {})
	];
	expect(cases.map((item) => item.output)).toEqual([[], [], []]);
	recordState('checkverificationforwards-returned-no-issues-when-every-regi', cases);
});

test('checkVerificationForwards returned one registry issue instead of throwing for a missing or unusable registry or root', async () => {
	const missing = ['scripts/verification-forward-registry.json is missing or invalid'];
	const cases: ExampleCase[] = [
		await checkCase('no registry file under the root', undefined, {}),
		await checkCase(
			'a registry file that is not valid JSON',
			'{"schemaVersion": 1, "forwards": [',
			{}
		),
		await checkCase(
			'a registry with an unsupported schema version',
			{ schemaVersion: 2, forwards: [] },
			{}
		),
		{
			name: 'a root that is not a string',
			input: { root: 42 },
			output: checkVerificationForwards(42 as unknown as string)
		}
	];
	expect(cases.map((item) => item.output)).toEqual([
		missing,
		missing,
		['scripts/verification-forward-registry.json has an unsupported registry shape'],
		missing
	]);
	recordState('checkverificationforwards-returned-one-registry-issue-instea', cases);
});

test('checkVerificationForwards reported each discovered forward that the registry does not list', async () => {
	const cases = [
		await checkCase('a utils forward that the registry leaves out', reg(), {
			[forward]: utilsForward,
			[target]: canonical
		}),
		await checkCase(
			'a nested forward left out beside a registered utils forward',
			reg(entry(forward)),
			{ [forward]: utilsForward, [nested]: nestedForward, [target]: canonical }
		)
	];
	expect(cases.map((item) => item.output)).toEqual([
		[`${forward} is a compatibility forward missing from ${registryPath}`],
		[`${nested} is a compatibility forward missing from ${registryPath}`]
	]);
	recordState('checkverificationforwards-reported-each-discovered-forward-t', cases);
});

test('checkVerificationForwards reported each registered forward that is missing, resolves elsewhere or has drifted', async () => {
	const cases = [
		await checkCase('the registered source file is missing', reg(entry(forward)), {
			[target]: canonical
		}),
		await checkCase('the canonical target file is missing', reg(entry(forward)), {
			[forward]: utilsForward
		}),
		await checkCase(
			'a forward that re-exports another file instead of its canonical target',
			reg(entry(forward)),
			{
				[forward]: moduleWith(uid, `export * from './legacyPlan';`),
				[legacy]: canonical,
				[target]: canonical
			}
		),
		await checkCase(
			'a forward marked active, with its UID and its target UID changed',
			reg(entry(forward, 'active')),
			{
				[forward]: moduleWith('u_example02', `export * from '${fromUtils}';`),
				[target]: moduleWith('u_example03', implementation)
			}
		)
	];
	expect(cases.map((item) => item.output)).toEqual([
		[`${forward} is missing`],
		[`${forward} names missing canonical target ${target}`],
		[`${forward} resolves to ${legacy}, not ${target}`],
		[
			`${forward} is not marked deprecated`,
			`${forward} no longer retains UID ${uid}`,
			`${forward} target no longer owns UID ${uid}`
		]
	]);
	recordState('checkverificationforwards-reported-each-registered-forward-t', cases);
});

test('checkVerificationForwards threw for a registered source or target that exists but cannot be read', async () => {
	const cases = [
		await checkCase('the registered source path is a folder', reg(entry(forward)), {
			[forward]: null,
			[target]: canonical
		}),
		await checkCase('the canonical target path is a folder', reg(entry(forward)), {
			[forward]: utilsForward,
			[target]: null
		})
	];
	expect(cases.map((item) => item.error)).toMatchObject([
		{ code: 'EISDIR' },
		{ code: 'EISDIR' }
	]);
	recordState('checkverificationforwards-threw-for-a-registered-source-or-t', cases);
});

test('checkVerificationForwards threw for a registry entry that is null or has a non-string path or target', async () => {
	const files = { [forward]: utilsForward, [target]: canonical };
	const cases = [
		await checkCase('a null entry in the forwards list', reg(null), files),
		await checkCase(
			'an entry whose path is the number 42',
			reg({ ...entry(forward), path: 42 }),
			files
		),
		await checkCase(
			'an entry whose target is null',
			reg({ ...entry(forward), target: null }),
			files
		)
	];
	expect(cases.map((item) => item.error)).toMatchObject([
		{ name: 'TypeError' },
		{ name: 'TypeError' },
		{ name: 'TypeError' }
	]);
	recordState('checkverificationforwards-threw-for-a-registry-entry-that-is', cases);
});
