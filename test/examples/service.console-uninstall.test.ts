import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { ConsoleUninstallService } from '../../src/cli/program/ConsoleUninstallService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const path = 'src/cli/program/ConsoleUninstallService.ts';
const hash = (content: string) => createHash('sha256').update(content).digest('hex');

async function installedHost(directory: string, content: string, prior: unknown[] = []): Promise<void> {
	await mkdir(join(directory, 'src/cli/program'), { recursive: true });
	await writeFile(join(directory, path), content);
	await writeFile(
		join(directory, 'harness.console.json'),
		JSON.stringify({
			schemaVersion: 1,
			files: [{ path, sha256: hash('generated'), owner: 'harness' }],
			changes: prior
		})
	);
}

function record(state: string, input: unknown, output: unknown): void {
	recordExampleCases(
		{
			unitId: 'service.console-uninstall',
			symbol: 'ConsoleUninstallService.uninstall',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: state, input, output }]
	);
}

test('Removes unchanged generated files and clears the manifest', async () => {
	await withTempDir('console-uninstall-clean-', async (directory) => {
		await installedHost(directory, 'generated');
		const result = await new ConsoleUninstallService().uninstall({ host: directory });
		expect(result).toMatchObject({ removed: [path], restored: [], kept: [], clean: true });
		record('removes-unchanged-generated-files-and-clears-the-manifest', { host: '/workspace/project' }, {
			host: '/workspace/project', removed: [path], restored: [], kept: [], changes: [], clean: true
		});
	});
});

test('Keeps edited generated files as host-owned when requested', async () => {
	await withTempDir('console-uninstall-keep-', async (directory) => {
		await installedHost(directory, 'host edit');
		const result = await new ConsoleUninstallService().uninstall({ host: directory, keep: true });
		expect(result).toMatchObject({ removed: [], kept: [path], clean: false });
		record('keeps-edited-generated-files-as-host-owned-when-requested',
			{ host: '/workspace/project', update: false, keep: true },
			{ host: '/workspace/project', removed: [], restored: [], kept: [path], changes: [], clean: false });
	});
});

test('Updates edited generated files by recording and removing them', async () => {
	await withTempDir('console-uninstall-update-', async (directory) => {
		await installedHost(directory, 'host edit');
		const result = await new ConsoleUninstallService().uninstall({ host: directory, update: true });
		expect(result).toMatchObject({ removed: [path], restored: [], kept: [], clean: false });
		expect(result.changes[0]).toMatchObject({ path, action: 'removed', reason: 'edited since it was installed' });
		record('updates-edited-generated-files-by-recording-and-removing-the',
			{ host: '/workspace/project', update: true, keep: false },
			{ host: '/workspace/project', removed: [path], restored: [], kept: [], changes: [{ path, action: 'removed', reason: 'edited since it was installed' }], clean: false });
	});
});
