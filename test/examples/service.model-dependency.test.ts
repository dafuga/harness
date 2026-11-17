import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ModelDependencyService } from '../../src/services/development-tooling/ModelDependencyService';

const BASE_MANIFEST = {
	name: 'sqlite-models',
	version: '0.1.0',
	dependencies: { 'left-pad': '1.0.0' }
};

const TRAILING_COMMA = '{\n\t"name": "sqlite-models",\n}\n';

function meta(state: string) {
	return {
		unitId: 'service.model-dependency',
		symbol: 'ensure',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function addedKeys(before: Record<string, string>, after: Record<string, string>): string[] {
	return Object.keys(after).filter((key) => !(key in before));
}

async function writeManifest(directory: string, text: string): Promise<void> {
	await writeFile(join(directory, 'package.json'), text);
}

function readManifest(directory: string): Promise<string> {
	return readFile(join(directory, 'package.json'), 'utf8');
}

test('Adds the shared runtime dependency to a package manifest', async () => {
	await withTempDir('model-dependency-add-', async (directory) => {
		await writeManifest(directory, JSON.stringify(BASE_MANIFEST, null, '\t') + '\n');
		const results = await new ModelDependencyService().ensure(directory);
		const written = JSON.parse(results[0].contents) as { dependencies: Record<string, string> };
		const added = addedKeys(BASE_MANIFEST.dependencies, written.dependencies);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ path: 'package.json', status: 'overwritten' });
		expect(results[0].contents.endsWith('\n')).toBe(true);
		expect(added).toHaveLength(1);
		expect(written.dependencies[added[0]]).toMatch(/^\^\d+\.\d+\.\d+/);
		expect(written.dependencies['left-pad']).toBe('1.0.0');
		expect(await readManifest(directory)).toBe(results[0].contents);
		recordExampleCases(meta('adds-the-shared-runtime-dependency-to-a-package-manifest'), [
			{
				name: 'manifest with one dependency gains the shared runtime at a caret version',
				input: { root: 'temporary directory', manifest: BASE_MANIFEST },
				output: {
					path: 'package.json',
					status: 'overwritten',
					addedDependency: added[0],
					versionPrefix: '^'
				}
			}
		]);
	});
});

test('Leaves an updated manifest unchanged on a second run', async () => {
	await withTempDir('model-dependency-idempotent-', async (directory) => {
		await writeManifest(directory, JSON.stringify(BASE_MANIFEST, null, '\t') + '\n');
		const service = new ModelDependencyService();
		const first = await service.ensure(directory);
		const second = await service.ensure(directory);
		expect(first).toHaveLength(1);
		expect(second).toEqual([]);
		expect(await readManifest(directory)).toBe(first[0].contents);
		recordExampleCases(meta('leaves-an-updated-manifest-unchanged-on-a-second-run'), [
			{
				name: 'second ensure after an update writes nothing and resolves to an empty array',
				input: { manifest: BASE_MANIFEST, runs: 2 },
				output: { firstStatus: first[0].status, secondResult: second }
			}
		]);
	});
});

test('Resolves to no files when the package manifest is missing', async () => {
	await withTempDir('model-dependency-missing-', async (directory) => {
		const results = await new ModelDependencyService().ensure(directory);
		expect(results).toEqual([]);
		expect(await readdir(directory)).toEqual([]);
		recordExampleCases(meta('resolves-to-no-files-when-the-package-manifest-is-missing'), [
			{
				name: 'directory without package.json resolves to an empty array',
				input: { root: 'temporary directory', manifest: 'absent' },
				output: []
			}
		]);
	});
});

test('Rejects without writing when the manifest is not valid JSON', async () => {
	await withTempDir('model-dependency-invalid-', async (directory) => {
		await writeManifest(directory, TRAILING_COMMA);
		let error: unknown;
		try {
			await new ModelDependencyService().ensure(directory);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(SyntaxError);
		expect(await readManifest(directory)).toBe(TRAILING_COMMA);
		recordExampleCases(meta('rejects-without-writing-when-the-manifest-is-not-valid-json'), [
			{
				name: 'trailing comma in manifest rejects with SyntaxError and leaves the file unchanged',
				input: { root: 'temporary directory', manifest: 'trailing comma' },
				error: { name: (error as Error).name }
			}
		]);
	});
});
