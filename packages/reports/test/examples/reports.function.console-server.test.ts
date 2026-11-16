import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { consoleDirectory, consoleData } from '../../src/utils/explorer-ui/console-server/consoleServer';

function temporaryDirectory(): string {
	return mkdtempSync(join(tmpdir(), 'console-server-'));
}

test('Resolves the configured console history directory', () => {
	const root = temporaryDirectory();
	try {
		vi.stubEnv('HARNESS_CONSOLE_DATA', ` ${root} `);
		const directory = consoleDirectory();
		expect(directory).toBe(resolve(root));
		recordExampleCases(
			{
				unitId: 'reports.function.console-server',
				symbol: 'consoleDirectory',
				state: 'resolves-the-configured-console-history-directory',
				evidence: 'examples-cases',
				file: 'resolves-the-configured-console-history-directory.json'
			},
			[{ name: 'trims and resolves the configured path', input: ` ${root} `, output: directory }]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(root, { recursive: true, force: true });
	}
});

test('Reads console history JSON and media from its directory', async () => {
	const root = temporaryDirectory();
	const payload = { build: 'fixture-build', packages: ['reports'] };
	const media = Buffer.from([137, 80, 78, 71]);
	try {
		mkdirSync(join(root, 'media'));
		writeFileSync(join(root, 'index.json'), JSON.stringify(payload));
		writeFileSync(join(root, 'media', 'fixture.png'), media);
		vi.stubEnv('HARNESS_CONSOLE_DATA', root);
		const json = await consoleData.json('index.json');
		const image = await consoleData.media('fixture.png');
		const missing = await consoleData.json('missing.json');
		expect(json).toBe(JSON.stringify(payload));
		expect(image?.type).toBe('image/png');
		expect(missing).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'reports.function.console-server',
				symbol: 'consoleData',
				state: 'reads-console-history-json-and-media-from-its-directory',
				evidence: 'examples-cases',
				file: 'reads-console-history-json-and-media-from-its-directory.json'
			},
			[
				{ name: 'existing index JSON', input: 'index.json', output: payload },
				{
					name: 'existing PNG media',
					input: 'fixture.png',
					output: { type: image?.type, bytes: image ? Array.from(image.bytes) : [] }
				},
				{ name: 'missing JSON file', input: 'missing.json', output: missing }
			]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(root, { recursive: true, force: true });
	}
});
