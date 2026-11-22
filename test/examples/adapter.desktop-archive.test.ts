import { test } from 'vitest';
import { createPackageWithOptions } from '@electron/asar';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { DesktopArchiveAdapter } from '../../scripts/prepare-desktop-experiment/DesktopArchiveAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('read extracts requested archive entries as strings', async () => {
	await withTempDir('desktop-archive-read-example-', async (directory) => {
		const files = join(directory, 'files');
		await mkdir(join(files, 'resources'), { recursive: true });
		await writeFile(join(files, 'package.json'), '{"name":"desktop-fixture"}');
		await writeFile(join(files, 'resources/app.js'), 'module.exports = 7;');
		const source = join(directory, 'desktop.asar');
		await finished(await createPackageWithOptions(files, source, {}));

		const input = {
			source: 'artifacts/desktop.asar',
			paths: ['package.json', 'resources/app.js']
		};
		const output = Object.fromEntries(new DesktopArchiveAdapter().read(source, input.paths));
		expect(output).toEqual({
			'package.json': '{"name":"desktop-fixture"}',
			'resources/app.js': 'module.exports = 7;'
		});
		recordExampleCases(
			{
				unitId: 'adapter.desktop-archive',
				symbol: 'DesktopArchiveAdapter.read',
				state: 'read-extracts-requested-archive-entries-as-strings',
				evidence: 'examples-cases',
				file: 'read-extracts-requested-archive-entries-as-strings.json'
			},
			[{ name: 'read package metadata and an application entry', input, output }]
		);
	});
});

test('patch rebuilds an archive with replaced and added entries', async () => {
	await withTempDir('desktop-archive-patch-example-', async (directory) => {
		const files = join(directory, 'files');
		await mkdir(join(files, 'resources'), { recursive: true });
		await writeFile(join(files, 'package.json'), '{"name":"desktop-fixture","version":"1.0.0"}');
		await writeFile(join(files, 'resources/app.js'), 'module.exports = 7;');
		const source = join(directory, 'desktop.asar');
		const target = join(directory, 'desktop-patched.asar');
		await finished(await createPackageWithOptions(files, source, {}));

		const changes = new Map([
			['package.json', '{"name":"desktop-fixture","version":"2.0.0"}'],
			['resources/bridge.js', 'module.exports = true;']
		]);
		const input = {
			source: 'artifacts/desktop.asar',
			target: 'artifacts/desktop-patched.asar',
			changes: Object.fromEntries(changes)
		};
		const adapter = new DesktopArchiveAdapter();
		const headerDigest = await adapter.patch(source, target, changes);
		const entries = Object.fromEntries(adapter.read(target, ['package.json', 'resources/bridge.js']));
		const output = { headerDigest, entries };
		expect(headerDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(entries).toEqual({
			'package.json': '{"name":"desktop-fixture","version":"2.0.0"}',
			'resources/bridge.js': 'module.exports = true;'
		});
		recordExampleCases(
			{
				unitId: 'adapter.desktop-archive',
				symbol: 'DesktopArchiveAdapter.patch',
				state: 'patch-rebuilds-an-archive-with-replaced-and-added-entries',
				evidence: 'examples-cases',
				file: 'patch-rebuilds-an-archive-with-replaced-and-added-entries.json'
			},
			[{ name: 'replace package metadata and add a bridge entry', input, output }]
		);
	});
});

test('patch rejects an identical source and target path', async () => {
	const source = 'artifacts/desktop.asar';
	const input = { source, target: source, changes: {} };
	const result = await new DesktopArchiveAdapter().patch(source, source, new Map()).then(
		() => ({ kind: 'resolved' as const }),
		(error: unknown) => {
			if (!(error instanceof Error)) throw error;
			return { name: error.name, message: error.message };
		}
	);
	expect(result).toEqual({
		name: 'ArchiveDestinationNotSeparateError',
		message: 'Archive destination must be a separate copy'
	});
	recordExampleCases(
		{
			unitId: 'adapter.desktop-archive',
			symbol: 'DesktopArchiveAdapter.patch',
			state: 'patch-rejects-an-identical-source-and-target-path',
			evidence: 'examples-cases',
			file: 'patch-rejects-an-identical-source-and-target-path.json'
		},
		[{ name: 'source and target use the same path', input, error: result }]
	);
});
