import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { VideoReferenceService } from '../../src/services/verification-evidence/VideoReferenceService';
import { safeReferencePath } from '../../src/services/verification-evidence/video-reference-service/binding';
import {
	metadataLimit,
	createReferenceCache,
	memoCatalog
} from '../../src/services/verification-evidence/video-reference-service/referenceCache';

const pathInputs = ['videos/clip.mp4', '../outside/clip.mp4', '/absolute/clip.mp4'];

test('Rejects reference paths that escape the evidence root', () => {
	const outputs = pathInputs.map((path) => safeReferencePath(path));
	expect(outputs[0]).toBe(true);
	expect(outputs[1]).toBe(false);
	expect(outputs[2]).toBe(false);
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-reference',
			symbol: 'safeReferencePath',
			state: 'rejects-reference-paths-that-escape-the-evidence-root',
			evidence: 'examples-cases',
			file: 'rejects-reference-paths-that-escape-the-evidence-root.json'
		},
		pathInputs.map((path, index) => ({
			name: `reference path ${path} is ${outputs[index] ? 'admitted' : 'rejected'}`,
			input: { path },
			output: outputs[index]
		}))
	);
});

test('Allocates empty reference caches with the metadata limit', () => {
	const memo = createReferenceCache();
	expect(memo.origins.values.size).toBe(0);
	expect(memo.catalogs.pending.size).toBe(0);
	expect(memo.catalogs.bytes).toBe(0);
	expect(metadataLimit).toBe(8 * 1024 * 1024);
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-reference',
			symbol: 'createReferenceCache',
			state: 'allocates-empty-reference-caches-with-the-metadata-limit',
			evidence: 'examples-cases',
			file: 'allocates-empty-reference-caches-with-the-metadata-limit.json'
		},
		[
			{
				name: 'new cache holds no origin or catalog values',
				input: {},
				output: { originValues: 0, catalogPending: 0, catalogBytes: 0 }
			},
			{
				name: 'metadata limit is 8 MiB',
				input: {},
				output: { metadataLimit }
			}
		]
	);
});

test('Loads a catalog once and reuses the memoized result', async () => {
	const memo = createReferenceCache();
	let loads = 0;
	const load = () => {
		loads += 1;
		return Promise.resolve([]);
	};
	const first = await memoCatalog(memo, 'scope-a', load);
	const second = await memoCatalog(memo, 'scope-a', load);
	expect(loads).toBe(1);
	expect(second).toEqual(first);
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-reference',
			symbol: 'memoCatalog',
			state: 'loads-a-catalog-once-and-reuses-the-memoized-result',
			evidence: 'examples-cases',
			file: 'loads-a-catalog-once-and-reuses-the-memoized-result.json'
		},
		[
			{
				name: 'second call with the same key does not invoke the loader',
				input: { key: 'scope-a' },
				output: { loads, catalogLength: second.length }
			}
		]
	);
});

export { VideoReferenceService };
