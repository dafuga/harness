import { expect, test } from 'vitest';
import type { SourceTree, TreeEntry } from '../../../src/core/sourceTypes';
import { defaultUnitsConfig } from '../../../src/core/unitsConfig';
import { SourceIndexService } from '../../../src/services/source-index-service/SourceIndexService';
import { measureWorkload } from '../../support/measureWorkload';

/** A delayed snapshot exposes overlapping reads while retaining their real source order. */
function delayedTree(count: number, failed?: string) {
	const entries = Array.from({ length: count }, (_, index) => ({
		path: `src/utils/item${index}.ts`,
		hash: `blob-${index}`
	}));
	const state = { active: 0, peak: 0, completed: [] as string[] };
	const tree: SourceTree = {
		revision: 'delayed',
		list: async () => entries,
		async read(path) {
			state.active++;
			state.peak = Math.max(state.peak, state.active);
			await new Promise((resolve) => setTimeout(resolve, path.endsWith('0.ts') ? 4 : 1));
			state.active--;
			state.completed.push(path);
			if (path === failed) throw new Error(`Cannot read ${path}`);
			return `export const item = ${entries.findIndex((entry) => entry.path === path)};\n`;
		}
	};
	return { entries, state, tree };
}

test('source indexing bounds pending reads and keeps every file in source order', async () => {
	const { entries, state, tree } = delayedTree(300);
	const index = await measureWorkload('service.source-index', 'index-many-source-files', () =>
		new SourceIndexService().index(tree, defaultUnitsConfig)
	);
	expect(state.peak).toBeLessThanOrEqual(256);
	expect(state.active).toBe(0);
	expect(state.completed).toHaveLength(entries.length);
	expect([...index.files.keys()]).toEqual(entries.map((entry) => entry.path));
	for (const [number, entry] of entries.entries()) {
		expect(index.files.get(entry.path)).toMatchObject({
			hash: entry.hash,
			bytes: Buffer.byteLength(`export const item = ${number};\n`),
			read: true
		});
	}
});

test('source indexing reports failed reads even after its read window fills', async () => {
	const path = 'src/utils/item280.ts';
	const { tree } = delayedTree(300, path);
	await expect(new SourceIndexService().index(tree, defaultUnitsConfig)).rejects.toThrow(
		`Cannot read ${path}`
	);
});

test('source indexing releases parsed blobs from prior revisions', async () => {
	const service = new SourceIndexService();
	const cache = (service as unknown as { parsed: Map<string, unknown> }).parsed;
	await measureWorkload('service.source-index', 'index-32-revisions', async () => {
		for (const number of Array.from({ length: 32 }, (_, index) => index)) {
			const revision = `revision-${number}`;
			await service.index(
				{
					revision,
					list: async () => [{ path: `src/utils/${revision}.ts`, hash: `${revision}-blob` }],
					read: async () => `export const value = '${revision}';\n`
				},
				defaultUnitsConfig
			);
			expect(cache.size).toBe(1);
		}
	});
});

test('identical blobs keep path-specific references and ignored files stay unread', async () => {
	const entries = [
		{ path: 'src/utils/one/copy.ts', hash: 'same' },
		{ path: 'src/utils/two/copy.ts', hash: 'same' },
		{ path: 'src/utils/one/dependency.ts', hash: 'one' },
		{ path: 'src/utils/two/dependency.ts', hash: 'two' },
		{ path: 'src/utils/ignored.md', hash: 'ignored' }
	];
	const reads: string[] = [];
	const tree: SourceTree = {
		revision: 'copies',
		list: async () => entries,
		async read(path) {
			reads.push(path);
			return path.endsWith('copy.ts') ? "import './dependency';\n" : 'export const x = 1;\n';
		}
	};
	const index = await new SourceIndexService().index(tree, defaultUnitsConfig);
	expect(reads).not.toContain('src/utils/ignored.md');
	for (const folder of ['one', 'two'])
		expect(index.files.get(`src/utils/${folder}/copy.ts`)?.references).toContainEqual({
			path: `src/utils/${folder}/dependency.ts`,
			via: 'import',
			typeOnly: false
		});
});

test('source indexing preserves admitted entry getters, species, and method receivers', async () => {
	let speciesChecks = 0;
	let pathReads = 0;
	class Entries extends Array<TreeEntry> {
		static get [Symbol.species]() {
			speciesChecks++;
			return Array;
		}
	}
	const entries = new Entries();
	entries.push({
		get path() {
			pathReads++;
			return 'src/utils/observed.ts';
		},
		hash: 'observed'
	});
	Object.defineProperty(entries, Symbol.iterator, {
		value: () => {
			throw new Error('The entry list iterator must not be needed');
		}
	});
	const tree: SourceTree = {
		revision: 'getter',
		list: async () => entries,
		async read(path) {
			expect(this).toBe(tree);
			expect(path).toBe('src/utils/observed.ts');
			return 'export const observed = true;\n';
		}
	};
	const index = await new SourceIndexService().index(tree, defaultUnitsConfig);
	expect([...index.files.keys()]).toEqual(['src/utils/observed.ts']);
	expect(speciesChecks).toBe(2);
	expect(pathReads).toBeGreaterThan(0);
});
