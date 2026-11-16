import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	consoleObjects,
	renderConsoleChange,
	renderConsoleInstall,
	renderConsoleUninstall
} from '../../src/cli/program/installConsole';

test('Lists indexed files under a bucket prefix', async () => {
	await withTempDir('install-console-index-', async (directory) => {
		await mkdir(join(directory, 'revisions'));
		await mkdir(join(directory, 'notes'));
		await writeFile(join(directory, 'index.json'), '{}');
		await writeFile(join(directory, 'revisions', `${'a'.repeat(40)}.json`), '{}');
		await writeFile(join(directory, 'notes', 'draft.txt'), 'ignored');
		const result = await consoleObjects(directory, 'history/');
		expect(result.map(({ key }) => key)).toEqual([
			'history/index.json',
			`history/revisions/${'a'.repeat(40)}.json`
		]);
		recordExampleCases(
			{
				unitId: 'workflow.install-console',
				symbol: 'consoleObjects',
				state: 'lists-indexed-files-under-a-bucket-prefix',
				evidence: 'examples-cases',
				file: 'lists-indexed-files-under-a-bucket-prefix.json'
			},
			[
				{
					name: 'lists index and revision while omitting unrelated files',
					input: { prefix: 'history/', files: ['index.json', 'revisions/<40 hex>.json', 'notes/draft.txt'] },
					output: result.map(({ key }) => key)
				}
			]
		);
	});
});

test('Renders a removed file change', () => {
	const change = {
		path: 'src/routes/harness/+server.ts',
		action: 'removed' as const,
		reason: 'edited since it was installed',
		at: '2026-11-15T11:08:26.950Z',
		before: {
			sha256: '3b8d1a6f0c4e9725d1b7a3f8e6c0d4a2b9f5e1c7d3a8b6f2e0c4d9a7b5f1e3c8',
			bytes: 903,
			saved: '.harness/console/replaced/original'
		},
		after: null
	};
	const output = renderConsoleChange(change);
	expect(output).toContain('removed src/routes/harness/+server.ts');
	recordExampleCases(
		{
			unitId: 'workflow.install-console',
			symbol: 'renderConsoleChange',
			state: 'renders-a-removed-file-change',
			evidence: 'examples-cases',
			file: 'renders-a-removed-file-change.json'
		},
		[{ name: 'shows the removed content as nothing', input: change, output }]
	);
});

test('Renders a clean uninstall result', () => {
	const result = {
		host: '/srv/site',
		removed: ['src/routes/harness/+server.ts'],
		restored: [],
		kept: [],
		changes: [],
		clean: true
	};
	const output = renderConsoleUninstall(result);
	expect(output).toContain('harness.console.json was removed as well.');
	recordExampleCases(
		{
			unitId: 'workflow.install-console',
			symbol: 'renderConsoleUninstall',
			state: 'renders-a-clean-uninstall-result',
			evidence: 'examples-cases',
			file: 'renders-a-clean-uninstall-result.json'
		},
		[{ name: 'reports removed files and clean record removal', input: result, output }]
	);
});

test('Renders a bucket backed installation', () => {
	const result = {
		host: '/srv/site',
		base: '/harness',
		policy: '$lib/server/harnessPolicy#harnessPolicy',
		written: ['src/routes/harness/+server.ts'],
		removed: [],
		kept: [],
		changes: [],
		data: { revisions: 1, media: 1, bytes: 2690146 },
		storage: { kind: 'bucket' as const, binding: 'HARNESS_HISTORY', prefix: 'history' },
		bundle: null,
		warnings: []
	};
	const output = renderConsoleInstall(result);
	expect(output).toContain('HARNESS_HISTORY under history/');
	recordExampleCases(
		{
			unitId: 'workflow.install-console',
			symbol: 'renderConsoleInstall',
			state: 'renders-a-bucket-backed-installation',
			evidence: 'examples-cases',
			file: 'renders-a-bucket-backed-installation.json'
		},
		[{ name: 'describes private bucket storage and uploaded history', input: result, output }]
	);
});
