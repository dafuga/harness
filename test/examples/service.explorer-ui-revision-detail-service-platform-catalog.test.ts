import type { ExampleCase } from './service.explorer-ui-revision-detail-service-platform-catalog.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { SourceTree } from '../../src/core/development-tooling/sourceTypes';
import { readPlatformCatalog } from '../../src/services/explorer-ui/revision-detail-service/platformCatalog';

const validManifest = JSON.stringify({
	schemaVersion: 1,
	platforms: [
		{
			id: 'web',
			runtime: 'Node.js 22',
			status: 'configured',
			summary: 'Browser build of the explorer UI.',
			configuration: [
				{
					name: 'BUILD_OUTPUT',
					value: 'dist',
					description: 'Directory that the production build writes to.'
				}
			],
			commands: [{ name: 'build', command: 'npm run build' }],
			requirements: ['Node.js 22 or later'],
			sources: ['package.json', 'tsconfig.json']
		}
	]
});

const invalidManifests: Record<string, string> = {
	'not JSON': '{ "schemaVersion": 1',
	'wrong schema': JSON.stringify({ schemaVersion: 2, platforms: [] })
};

/** In-memory revision tree: list() returns the given paths and read() returns their contents. */
function treeWith(files: Record<string, string>): SourceTree {
	return {
		revision: 'rev-example',
		list: async () => Object.keys(files).map((path) => ({ path })),
		read: async (path: string) => {
			const content = files[path];
			if (content === undefined) throw new Error(`missing ${path}`);
			return content;
		}
	} as SourceTree;
}

function meta(state: string) {
	return {
		unitId: 'service.explorer-ui-revision-detail-service-platform-catalog',
		symbol: 'readPlatformCatalog',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Reads the platform catalog declared at the revision', async () => {
	const catalog = await readPlatformCatalog(treeWith({ 'harness.platforms.json': validManifest }));

	expect(catalog.gap).toBeUndefined();
	expect(catalog.entries.map((entry) => entry.id)).toEqual(['web']);
	recordExampleCases(meta('reads-the-platform-catalog-declared-at-the-revision'), [
		{
			name: 'valid manifest lists one configured platform with no gap',
			input: { files: ['harness.platforms.json'] },
			output: catalog
		}
	]);
});

test('Reports a gap when the revision has no platform manifest', async () => {
	const catalog = await readPlatformCatalog(treeWith({ 'README.md': '# Example' }));

	expect(catalog.entries).toEqual([]);
	expect(catalog.gap).toBe('No platform configuration is recorded at this revision.');
	recordExampleCases(meta('reports-a-gap-when-the-revision-has-no-platform-manifest'), [
		{
			name: 'tree without harness.platforms.json returns an empty catalog with a gap',
			input: { files: ['README.md'] },
			output: catalog
		}
	]);
});

test('Reports a gap when the platform manifest is invalid', async () => {
	const cases: ExampleCase[] = [];
	for (const [name, content] of Object.entries(invalidManifests)) {
		const catalog = await readPlatformCatalog(treeWith({ 'harness.platforms.json': content }));
		expect(catalog.entries).toEqual([]);
		expect(catalog.gap).toContain('Check harness.platforms.json');
		cases.push({ name: `${name} manifest returns an empty catalog with a gap`, input: { content }, output: catalog });
	}
	recordExampleCases(meta('reports-a-gap-when-the-platform-manifest-is-invalid'), cases);
});
