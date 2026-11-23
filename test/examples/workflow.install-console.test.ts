import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	installConsole,
	consoleObjects,
	uninstallConsole,
	restoreConsoleFile,
	renderConsoleChange,
	renderConsoleInstall,
	renderConsoleUninstall
} from '../../src/cli/program/installConsole';

test('Throws ExpectedCliError for invalid install and object inputs', async () => {
	await withTempDir('install-console-invalid-host-', async (host) => {
		const flags = {
			host,
			policy: '$lib/server/harnessPolicy',
			policyExport: 'harnessPolicy',
			base: '/harness'
		};
		await expect(installConsole(flags)).rejects.toThrow('is not a SvelteKit project');
		await expect(consoleObjects(host, '../private')).rejects.toThrow(
			'--prefix must be a plain path'
		);
		recordExampleCases(
			{
				unitId: 'workflow.install-console',
				symbol: 'installConsole and consoleObjects',
				state: 'throws-expectedclierror-for-invalid-install-and-object-input',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-for-invalid-install-and-object-input.json'
			},
			[
				{
					name: 'rejects an unconfigured host',
					input: flags,
					error: `${host} is not a SvelteKit project: it needs svelte.config.js and src/routes.`
				},
				{
					name: 'rejects traversal in bucket prefix',
					input: { directory: host, prefix: '../private' },
					error: '--prefix must be a plain path inside the bucket, such as history.'
				}
			]
		);
	});
});

test('Throws ExpectedCliError for invalid uninstall and restore inputs', async () => {
	const flags = { host: '/tmp/example-site', update: true, keep: true };
	expect(() => uninstallConsole(flags)).toThrow('Choose --update or --keep, not both.');
	await withTempDir('install-console-empty-restore-', async (directory) => {
		await expect(restoreConsoleFile(directory, 'src/routes/harness/+server.ts')).rejects.toThrow(
			'No replaced contents are recorded'
		);
		recordExampleCases(
			{
				unitId: 'workflow.install-console',
				symbol: 'uninstallConsole and restoreConsoleFile',
				state: 'throws-expectedclierror-for-invalid-uninstall-and-restore-in',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-for-invalid-uninstall-and-restore-in.json'
			},
			[
				{
					name: 'rejects simultaneous update and keep',
					input: flags,
					error: 'Choose --update or --keep, not both.'
				},
				{
					name: 'rejects a path without a recorded saved copy',
					input: { host: directory, path: 'src/routes/harness/+server.ts' },
					error: 'No replaced contents are recorded for src/routes/harness/+server.ts.'
				}
			]
		);
	});
});

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
					input: {
						prefix: 'history/',
						files: ['index.json', 'revisions/<40 hex>.json', 'notes/draft.txt']
					},
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
