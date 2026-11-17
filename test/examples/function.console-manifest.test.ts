import { test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	consoleManifest,
	consoleManifestFile,
	writeConsoleManifest
} from '../../src/utils/development-tooling/consoleManifest';
import type {
	ConsoleFileEntry,
	ConsoleManifest
} from '../../src/utils/development-tooling/consoleManifest.types';

const indexEntry: ConsoleFileEntry = {
	path: 'console/index.html',
	sha256: 'c41f7a08e93b26d5a1f0c8e7b4d29a63f5e1c0b8d7a6924e3f0b5c1d8e7a2f96',
	owner: 'harness'
};

const appEntry: ConsoleFileEntry = {
	path: 'console/assets/app.js',
	sha256: '5e8b1d0c7a4f93e2b6d1c08f4a7e2b9d3c6f1a0e8b5d2c7f4a9e6b3d0c1f8a27',
	owner: 'harness'
};

const unsortedRecord: ConsoleManifest = {
	schemaVersion: 1,
	files: [indexEntry, appEntry],
	changes: []
};

test('Returns an empty install record when no file exists', async () => {
	const record = await withTempDir('console-manifest-empty-', (host) => consoleManifest(host));

	expect(record).toEqual({ schemaVersion: 1, files: [], changes: [] });
	recordExampleCases(
		{
			unitId: 'function.console-manifest',
			symbol: 'consoleManifest',
			state: 'returns-an-empty-install-record-when-no-file-exists',
			evidence: 'examples-cases',
			file: 'returns-an-empty-install-record-when-no-file-exists.json'
		},
		[
			{
				name: 'host has never had the console installed',
				input: { host: 'empty temporary directory' },
				output: record
			}
		]
	);
});

test('Writes files sorted by path and reads them back', async () => {
	const readBack = await withTempDir('console-manifest-write-', async (host) => {
		await writeConsoleManifest(host, unsortedRecord);
		return consoleManifest(host);
	});

	expect(readBack).toEqual({ schemaVersion: 1, files: [appEntry, indexEntry], changes: [] });
	recordExampleCases(
		{
			unitId: 'function.console-manifest',
			symbol: 'writeConsoleManifest',
			state: 'writes-files-sorted-by-path-and-reads-them-back',
			evidence: 'examples-cases',
			file: 'writes-files-sorted-by-path-and-reads-them-back.json'
		},
		[
			{
				name: 'two harness files listed in reverse path order',
				input: unsortedRecord,
				output: readBack
			}
		]
	);
});

test('Rejects a stored record that is not valid JSON', async () => {
	const truncated = '{"schemaVersion": 1, "files": [';

	await withTempDir('console-manifest-malformed-', async (host) => {
		await writeFile(join(host, consoleManifestFile), truncated);
		await expect(consoleManifest(host)).rejects.toBeInstanceOf(SyntaxError);
	});
	recordExampleCases(
		{
			unitId: 'function.console-manifest',
			symbol: 'consoleManifest',
			state: 'rejects-a-stored-record-that-is-not-valid-json',
			evidence: 'examples-cases',
			file: 'rejects-a-stored-record-that-is-not-valid-json.json'
		},
		[
			{
				name: 'stored harness.console.json is cut short',
				input: { text: truncated },
				error: 'SyntaxError'
			}
		]
	);
});
