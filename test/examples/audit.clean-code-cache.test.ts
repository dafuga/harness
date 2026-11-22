import { test } from 'vitest';
import { mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cache from '../../src/audit/development-tooling/cleanCodeCache';
import type { CachedEvaluation } from '../../src/audit/development-tooling/cleanCodeCache.types';
import type { CleanCodeSettings } from '../../src/audit/development-tooling/cleanCodeTypes';
import type { ReviewSnapshot } from '../../src/audit/verification-evidence/cleanCodeSnapshot.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * The review cache is called the way evaluateCleanCodeFile calls it. Each test is one state; its
 * recorded cases are what the operation was given and what came back. The project root is
 * recorded as the label "project", so no temporary path enters the evidence.
 * An undefined or void result is recorded as null.
 */

const folder = '.cache/harness/clean-code';
const key = '8b7f5247e2937405454a84258cbe9bdcdb83604e7892f0ddc46618814d0ace78';
const settings: CleanCodeSettings = {
	mode: 'advisory',
	model: 'configured-model',
	minConfidence: 0.75,
	apiKeyEnv: 'API_KEY_ENV',
	exclude: []
};
const target = {
	path: 'src/audit/development-tooling/cleanCodeCache.ts',
	contents: 'export const enabled = true;\n',
	hash: 'db1242f0e836edaa9533cb367264cc3624520f3576b72d407ed0d1677545c26a'
};
const snapshot: ReviewSnapshot = {
	target,
	inputs: [target],
	contextHash: '40be9bbee81c0ccae949dc2586d0b3764f61e60f4e0580a2901fe83f37976248',
	state:
		'{"target":{"path":"src/audit/development-tooling/cleanCodeCache.ts","language":".ts","code":"export const enabled = true;\\n"},"related":[],"conventions":[],"omittedContext":[],"auditFindings":[]}',
	contextPaths: [],
	omittedContext: []
};
/** The contract's example evaluation, as the cache stores it. */
const evaluation = JSON.parse(
	'{"model":"configured-model","answers":{"meaningful-names":{"type":"choice","choice":"meets","confidence":0.94,"probabilities":{"meets":0.94,"violates":0.03,"not_applicable":0.01,"insufficient_context":0.02}}},"usage":{"input_tokens":128,"output_tokens":24}}'
) as CachedEvaluation['evaluation'];
const first: CachedEvaluation = { evaluation };
const revised = { evaluation: { ...evaluation, usage: { input_tokens: 131, output_tokens: 19 } } };

/** Names in a folder, sorted; a folder that does not exist holds none. */
const entries = async (path: string) => (await readdir(path).catch((): string[] => [])).sort();
/** Whether a file or folder can be reached at the path, following links. */
const exists = async (path: string) => (await stat(path).catch(() => null)) !== null;
/** Runs use in a project folder beside a folder outside the project; both are removed after. */
const withExternal = <T>(use: (root: string, external: string) => Promise<T>) =>
	withTempDir('clean-code-cache-external-', (external) =>
		withTempDir('clean-code-cache-project-', (root) => use(root, external))
	);

test('Keys a review by its settings, state and context hash', () => {
	const base = cache.reviewCacheKey(snapshot, settings);
	const moved = {
		...snapshot,
		target: { ...target, hash: 'e'.repeat(64) },
		inputs: [],
		contextPaths: ['AGENTS.md'],
		omittedContext: ['src/large.ts']
	};
	const stricter = { ...settings, minConfidence: 0.9 };
	const edited = {
		...snapshot,
		state: snapshot.state.replace('enabled = true', 'enabled = false'),
		contextHash: 'f'.repeat(64)
	};
	const withMoved = cache.reviewCacheKey(moved, settings);
	const withStricter = cache.reviewCacheKey(snapshot, stricter);
	const withEdited = cache.reviewCacheKey(edited, settings);
	// The contract's example output (8b7f...) is not the digest these inputs give; this is.
	expect(base).toBe('233598af08d87056d0810a2556c0441d4c3bff98e83321217d15b5225bbcaf09');
	expect(withMoved).toBe(base);
	expect(withStricter).not.toBe(base);
	expect(withEdited).not.toBe(base);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-cache',
			symbol: 'reviewCacheKey',
			state: 'keys-a-review-by-its-settings-state-and-context-hash',
			evidence: 'examples-cases',
			file: 'keys-a-review-by-its-settings-state-and-context-hash.json'
		},
		[
			{ name: 'the contract example', input: { snapshot, settings }, output: base },
			{ name: 'other target and paths', input: { snapshot: moved, settings }, output: withMoved },
			{ name: 'stricter minimum', input: { snapshot, settings: stricter }, output: withStricter },
			{ name: 'edited code', input: { snapshot: edited, settings }, output: withEdited }
		]
	);
});

test('Reads back the evaluation that was written under a key', async () => {
	await withTempDir('clean-code-cache-round-trip-', async (root) => {
		await cache.writeReviewCache(root, key, first);
		expect(await entries(join(root, folder))).toEqual([`${key}.json`]);
		const read = await cache.readReviewCache(root, key);
		await cache.writeReviewCache(root, key, revised);
		const replaced = await cache.readReviewCache(root, key);
		expect(read).toEqual(first);
		expect(await entries(join(root, folder))).toEqual([`${key}.json`]);
		expect(replaced).toEqual(revised);
		recordExampleCases(
			{
				unitId: 'audit.clean-code-cache',
				symbol: 'readReviewCache',
				state: 'reads-back-the-evaluation-that-was-written-under-a-key',
				evidence: 'examples-cases',
				file: 'reads-back-the-evaluation-that-was-written-under-a-key.json'
			},
			[
				{ name: 'first write', input: { root: 'project', key, value: first }, output: null },
				{ name: 'reads the stored evaluation back', input: { root: 'project', key }, output: read },
				{ name: 'second write', input: { root: 'project', key, value: revised }, output: null },
				{ name: 'reads the replacement back', input: { root: 'project', key }, output: replaced }
			]
		);
	});
});

test('Reads undefined for a missing or corrupt cache file', async () => {
	await withTempDir('clean-code-cache-miss-', async (root) => {
		const noFolder = await cache.readReviewCache(root, key);
		await mkdir(join(root, folder), { recursive: true });
		const noFile = await cache.readReviewCache(root, key);
		await writeFile(join(root, folder, `${key}.json`), '{"evaluation":');
		const corrupt = await cache.readReviewCache(root, key);
		expect([noFolder, noFile, corrupt]).toEqual([undefined, undefined, undefined]);
		recordExampleCases(
			{
				unitId: 'audit.clean-code-cache',
				symbol: 'readReviewCache',
				state: 'reads-undefined-for-a-missing-or-corrupt-cache-file',
				evidence: 'examples-cases',
				file: 'reads-undefined-for-a-missing-or-corrupt-cache-file.json'
			},
			[
				{ name: 'no cache folder exists yet', input: { root: 'project', key }, output: null },
				{ name: 'folder has no file for key', input: { root: 'project', key }, output: null },
				{ name: 'the stored file is not valid JSON', input: { root: 'project', key }, output: null }
			]
		);
	});
});

test('Refuses a cache path that resolves outside the project', async () => {
	const linkedFolder = await withExternal(async (root, external) => {
		await writeFile(join(external, `${key}.json`), JSON.stringify(first));
		await mkdir(join(root, '.cache/harness'), { recursive: true });
		await symlink(external, join(root, folder));
		return cache.readReviewCache(root, key);
	});
	const linkedFile = await withExternal(async (root, external) => {
		await writeFile(join(external, `${key}.json`), JSON.stringify(first));
		await mkdir(join(root, folder), { recursive: true });
		await symlink(join(external, `${key}.json`), join(root, folder, `${key}.json`));
		return cache.readReviewCache(root, key);
	});
	const linkedWrite = await withExternal(async (root, external) => {
		await mkdir(join(root, '.cache/harness'), { recursive: true });
		await symlink(external, join(root, folder));
		await cache.writeReviewCache(root, key, first);
		return entries(external);
	});
	const linkedAncestor = await withExternal(async (root, external) => {
		await symlink(external, join(root, '.cache'));
		await cache.writeReviewCache(root, key, first);
		return entries(external);
	});
	expect([linkedFolder, linkedFile]).toEqual([undefined, undefined]);
	expect([linkedWrite, linkedAncestor]).toEqual([[], []]);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-cache',
			symbol: 'readReviewCache',
			state: 'refuses-a-cache-path-that-resolves-outside-the-project',
			evidence: 'examples-cases',
			file: 'refuses-a-cache-path-that-resolves-outside-the-project.json'
		},
		[
			{ name: 'cache folder links outside', input: { root: 'project', key }, output: null },
			{ name: 'cache file links to a file outside', input: { root: 'project', key }, output: null },
			{ name: 'write through a link', input: { root: 'project', key, value: first }, output: null },
			{
				name: 'write with a linked ancestor',
				input: { root: 'project', key, value: first },
				output: null
			}
		]
	);
});

test('Swallows write failures so a review is not blocked', async () => {
	await withTempDir('clean-code-cache-failure-', async (base) => {
		const missing = join(base, 'not-created');
		const occupied = join(base, 'occupied');
		await mkdir(join(occupied, '.cache/harness'), { recursive: true });
		await writeFile(join(occupied, folder), 'not a folder');
		const onMissingRoot = await cache.writeReviewCache(missing, key, first);
		const onOccupied = await cache.writeReviewCache(occupied, key, first);
		expect([onMissingRoot, onOccupied]).toEqual([undefined, undefined]);
		expect(await exists(missing)).toBe(false);
		expect(await readFile(join(occupied, folder), 'utf8')).toBe('not a folder');
		recordExampleCases(
			{
				unitId: 'audit.clean-code-cache',
				symbol: 'writeReviewCache',
				state: 'swallows-write-failures-so-a-review-is-not-blocked',
				evidence: 'examples-cases',
				file: 'swallows-write-failures-so-a-review-is-not-blocked.json'
			},
			[
				{ name: 'root missing', input: { root: 'project', key, value: first }, output: null },
				{ name: 'cache is a file', input: { root: 'project', key, value: first }, output: null }
			]
		);
	});
});
