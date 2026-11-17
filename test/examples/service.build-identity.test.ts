import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { BuildIdentityService } from '../../src/services/verification-evidence/BuildIdentityService';
import type {
	BuiltIdentity,
	DeclaredBuild
} from '../../src/services/verification-evidence/BuildIdentityService.types';

const build: DeclaredBuild = {
	id: 'build-20261115T120000Z-linux-x64',
	directory: 'dist/linux-x64'
};
const emptySlot = `harness-build:${'0'.repeat(64)}`;
const staleBuildId = 'a'.repeat(64);
const meta = { unitId: 'service.build-identity', evidence: 'examples-cases' };

function writeFiles(root: string, files: Record<string, string>): void {
	for (const [path, text] of Object.entries(files)) {
		const file = join(root, path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
}

test('Identifies the files of a declared build', async () => {
	await withTempDir('build-identity-declared-', async (root) => {
		writeFiles(root, { 'dist/linux-x64/app.js': 'console.log("ok");' });
		const result = await new BuildIdentityService().declared(root, [build]);
		const [found] = result.found;

		expect(result.failures).toEqual([]);
		expect(result.found).toHaveLength(1);
		expect(found?.files).toBe(1);
		expect(found?.buildId).toMatch(/^[0-9a-f]{64}$/);
		recordExampleCases(
			{
				...meta,
				symbol: 'declared',
				state: 'identifies-the-files-of-a-declared-build',
				file: 'identifies-the-files-of-a-declared-build.json'
			},
			[
				{
					name: 'one unstamped file under a declared build directory',
					input: { builds: [build] },
					output: { found: result.found, failures: result.failures }
				}
			]
		);
	});
});

test('Reports declared builds that were not produced or lie outside the root', async () => {
	await withTempDir('build-identity-failures-', async (root) => {
		const missing = { id: 'build-missing', directory: 'dist/missing' };
		const outside = { id: 'build-outside', directory: '../outside' };
		const result = await new BuildIdentityService().declared(root, [missing, outside]);

		expect(result.found).toEqual([]);
		expect(result.failures).toEqual([
			'build build-missing was not produced: setup left no files in dist/missing',
			'build build-outside names a directory outside the repository'
		]);
		recordExampleCases(
			{
				...meta,
				symbol: 'declared',
				state: 'reports-declared-builds-that-were-not-produced-or-lie-outsid',
				file: 'reports-declared-builds-that-were-not-produced-or-lie-outsid.json'
			},
			[
				{
					name: 'missing directory and a directory outside the root',
					input: { builds: [missing, outside] },
					output: { found: result.found, failures: result.failures }
				}
			]
		);
	});
});

test('Stamps the build identity into its empty stamp slot', async () => {
	await withTempDir('build-identity-stamp-', async (root) => {
		const directory = join(root, build.directory);
		writeFiles(root, { 'dist/linux-x64/app.js': `const id = "${emptySlot}";` });
		const service = new BuildIdentityService();
		const stamped = await service.stamp(directory);
		const text = readFileSync(join(directory, 'app.js'), 'latin1');
		const identified = await service.identify(directory);

		expect(stamped.stamp).toBe(stamped.buildId);
		expect(text).toContain(`harness-build:${stamped.buildId}`);
		expect(identified?.buildId).toBe(stamped.buildId);
		expect(identified?.stamp).toBe(stamped.buildId);
		recordExampleCases(
			{
				...meta,
				symbol: 'stamp',
				state: 'stamps-the-build-identity-into-its-empty-stamp-slot',
				file: 'stamps-the-build-identity-into-its-empty-stamp-slot.json'
			},
			[
				{
					name: 'one file with an empty slot receives the computed identity',
					input: { directory: build.directory },
					output: { stamped, identified }
				}
			]
		);
	});
});

test('Reports builds whose identity changed since they were identified', async () => {
	await withTempDir('build-identity-changed-', async (root) => {
		writeFiles(root, { 'dist/linux-x64/app.js': 'console.log("ok");' });
		const service = new BuildIdentityService();
		const [current] = (await service.declared(root, [build])).found;
		const stale: BuiltIdentity = { ...build, buildId: staleBuildId, files: 1 };
		const unchanged = await service.changed(root, current ? [current] : []);
		const changed = await service.changed(root, [stale]);

		expect(unchanged).toEqual([]);
		expect(changed).toEqual([
			'build build-20261115T120000Z-linux-x64 changed while checks ran, so no capture can be tied to it'
		]);
		recordExampleCases(
			{
				...meta,
				symbol: 'changed',
				state: 'reports-builds-whose-identity-changed-since-they-were-identi',
				file: 'reports-builds-whose-identity-changed-since-they-were-identi.json'
			},
			[
				{
					name: 'identity still matches the files on disk',
					input: { builds: [current] },
					output: unchanged
				},
				{
					name: 'identity recorded earlier differs from the files on disk',
					input: { builds: [stale] },
					output: changed
				}
			]
		);
	});
});
