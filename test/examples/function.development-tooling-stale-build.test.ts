import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { staleBuild } from '../../src/utils/development-tooling/staleBuild';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Warns only when checkout source is newer than a dist entry', async () => {
	await withTempDir('stale-build-', (directory) => {
		const entry = join(directory, 'dist', 'cli.js');
		const source = join(directory, 'src', 'cli.ts');
		mkdirSync(join(directory, 'dist'), { recursive: true });
		mkdirSync(join(directory, 'src'), { recursive: true });
		writeFileSync(entry, 'built');
		writeFileSync(source, 'source');
		const old = new Date('2020-01-01T00:00:00Z');
		const recent = new Date('2021-01-01T00:00:00Z');
		utimesSync(entry, old, old);
		utimesSync(source, recent, recent);
		const stale = staleBuild(entry);
		const currentEntry = join(directory, 'dist', 'current.js');
		writeFileSync(currentEntry, 'built');
		utimesSync(currentEntry, recent, recent);
		const current = staleBuild(currentEntry);
		const outside = staleBuild(source);
		expect(stale).toBe('Warning: this dist build is older than source; run bun run build:cli before using it.');
		expect(current).toBeUndefined();
		expect(outside).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'function.development-tooling-stale-build',
				symbol: 'staleBuild',
				state: 'warns-only-when-checkout-source-is-newer-than-a-dist-entry',
				evidence: 'examples-cases',
				file: 'warns-only-when-checkout-source-is-newer-than-a-dist-entry.json'
			},
			[
				{ name: 'source file is newer than dist entry', input: '/fixture/dist/cli.js', output: stale },
				{ name: 'dist entry is newer than source', input: '/fixture/dist/current.js', output: current },
				{ name: 'entry is outside dist', input: '/fixture/src/cli.ts', output: outside }
			]
		);
	});
});
