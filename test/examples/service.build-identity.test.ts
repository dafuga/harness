import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { BuildIdentityService } from '../../src/services/verification-evidence/BuildIdentityService';
import type { DeclaredBuild } from '../../src/services/verification-evidence/BuildIdentityService.types';

const BUILD_ID = 'build-20261115T120000Z-linux-x64';
const DIRECTORY = 'dist/linux-x64';
const SLOT = `harness-build:${'0'.repeat(64)}`;
const DECLARED: DeclaredBuild[] = [{ id: BUILD_ID, directory: DIRECTORY }];

function meta(symbol: string, state: string) {
	return {
		unitId: 'service.build-identity',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

async function writeBuild(root: string, files: Record<string, string>): Promise<string> {
	const directory = join(root, DIRECTORY);
	await mkdir(directory, { recursive: true });
	for (const [name, text] of Object.entries(files)) {
		await writeFile(join(directory, name), text);
	}
	return directory;
}

test('Identifies the files of a declared build', async () => {
	await withTempDir('build-identity-identify-', async (root) => {
		await writeBuild(root, { 'app.js': 'console.log(1);\n', 'index.html': '<p>ok</p>' });
		const result = await new BuildIdentityService().declared(root, DECLARED);

		expect(result.failures).toEqual([]);
		expect(result.found).toHaveLength(1);
		expect(result.found[0]).toMatchObject({ id: BUILD_ID, directory: DIRECTORY, files: 2 });
		expect(result.found[0].buildId).toMatch(/^[0-9a-f]{64}$/);
		recordExampleCases(meta('declared', 'identifies-the-files-of-a-declared-build'), [
			{
				name: 'two files under a declared build directory',
				input: { directory: DIRECTORY, files: ['app.js', 'index.html'] },
				output: { found: result.found, failures: result.failures }
			}
		]);
	});
});

test('Reports declared builds that were not produced or lie outside the repository', async () => {
	await withTempDir('build-identity-failures-', async (root) => {
		const builds: DeclaredBuild[] = [
			{ id: 'build-not-produced', directory: 'dist/missing' },
			{ id: 'build-escape', directory: '../outside' }
		];
		const result = await new BuildIdentityService().declared(root, builds);

		expect(result.found).toEqual([]);
		expect(result.failures).toEqual([
			'build build-not-produced was not produced: setup left no files in dist/missing',
			'build build-escape names a directory outside the repository'
		]);
		recordExampleCases(
			meta('declared', 'reports-declared-builds-that-were-not-produced-or-lie-outsid'),
			[
				{
					name: 'missing directory and directory outside the root',
					input: { builds },
					output: { found: result.found, failures: result.failures }
				}
			]
		);
	});
});

test('Stamps the build identity into its empty stamp slot', async () => {
	await withTempDir('build-identity-stamp-', async (root) => {
		const directory = await writeBuild(root, {
			'app.js': `const id = "${SLOT}";`,
			'index.html': '<p>ok</p>'
		});
		const service = new BuildIdentityService();
		const result = await service.stamp(directory);
		const text = await readFile(join(directory, 'app.js'), 'utf8');
		const identified = await service.identify(directory);

		expect(result).toMatchObject({ files: 2, stamp: result.buildId });
		expect(text).toContain(`harness-build:${result.buildId}`);
		expect(text).not.toContain(SLOT);
		expect(identified?.stamp).toBe(result.buildId);
		recordExampleCases(meta('stamp', 'stamps-the-build-identity-into-its-empty-stamp-slot'), [
			{
				name: 'one slotted file and one plain file',
				input: { directory: DIRECTORY, slots: 1 },
				output: { files: result.files, stampEqualsBuildId: result.stamp === result.buildId }
			}
		]);
	});
});

test('Reports builds whose identity changed since they were identified', async () => {
	await withTempDir('build-identity-changed-', async (root) => {
		await writeBuild(root, { 'app.js': 'console.log(1);\n' });
		const service = new BuildIdentityService();
		const { found } = await service.declared(root, DECLARED);
		const unchanged = await service.changed(root, found);
		const tampered = [{ ...found[0], buildId: '0'.repeat(64) }];
		const changed = await service.changed(root, tampered);

		expect(unchanged).toEqual([]);
		expect(changed).toEqual([
			`build ${BUILD_ID} changed while checks ran, so no capture can be tied to it`
		]);
		recordExampleCases(
			meta('changed', 'reports-builds-whose-identity-changed-since-they-were-identi'),
			[
				{
					name: 'recorded identity matches the current files',
					input: { builds: found },
					output: unchanged
				},
				{
					name: 'recorded identity differs from the current files',
					input: { builds: tampered },
					output: changed
				}
			]
		);
	});
});

test('Throws ExpectedCliError when stamp finds no stamp slot', async () => {
	await withTempDir('build-identity-no-slot-', async (root) => {
		const directory = await writeBuild(root, { 'notes.txt': 'plain text' });
		let error: unknown;
		try {
			await new BuildIdentityService().stamp(directory);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('nothing in it reports a build identity');
		recordExampleCases(meta('stamp', 'throws-expectedclierror-when-stamp-finds-no-stamp-slot'), [
			{
				name: 'directory with no stamp slot in any file',
				input: { directory: DIRECTORY, files: ['notes.txt'] },
				error: {
					name: (error as Error).name,
					message: (error as Error).message.replace(directory, '<directory>')
				}
			}
		]);
	});
});

test('Throws Error when a build file cannot be read', async () => {
	await withTempDir('build-identity-unreadable-', async (root) => {
		const directory = await writeBuild(root, { 'app.js': 'console.log(1);\n' });
		const file = join(directory, 'app.js');
		await chmod(file, 0o000);
		let error: unknown;
		try {
			await new BuildIdentityService().identify(directory);
		} catch (caught) {
			error = caught;
		} finally {
			await chmod(file, 0o644);
		}

		expect(error).toBeInstanceOf(Error);
		recordExampleCases(meta('identify', 'throws-error-when-a-build-file-cannot-be-read'), [
			{
				name: 'file made unreadable inside the build directory',
				input: { directory: DIRECTORY, file: 'app.js', mode: '000' },
				error: {
					name: (error as Error).name,
					code: (error as { code?: string }).code ?? null
				}
			}
		]);
	});
});
