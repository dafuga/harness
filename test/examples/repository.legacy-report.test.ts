import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { LegacyReportRepository } from '../../src/cli/program/legacy-import-service/LegacyReportRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Reads valid manifests in sorted run order', async () => {
	await withTempDir('legacy-report-runs-', async (directory) => {
		const runs = join(directory, 'runs');
		for (const [id, manifest] of [
			['run-002', '{"name":"second"}'],
			['run-001', 'null']
		]) {
			const run = join(runs, id);
			mkdirSync(run, { recursive: true });
			writeFileSync(join(run, 'manifest.json'), manifest);
		}
		mkdirSync(join(runs, 'run-invalid'));
		writeFileSync(join(runs, 'run-invalid', 'manifest.json'), '{');
		mkdirSync(join(runs, 'run-missing'));

		const output = await new LegacyReportRepository(directory).runs();
		expect(output).toEqual([
			{ id: 'run-001', manifest: null },
			{ id: 'run-002', manifest: { name: 'second' } }
		]);
		recordExampleCases(
			{
				unitId: 'repository.legacy-report',
				symbol: 'runs',
				state: 'reads-valid-manifests-in-sorted-run-order',
				evidence: 'examples-cases',
				file: 'reads-valid-manifests-in-sorted-run-order.json'
			},
			[
				{
					name: 'valid direct run manifests are returned by directory name',
					input: { store: '/workspace/project' },
					output
				}
			]
		);
	});
});

test('Reads asset bytes and rejects paths outside the asset directory', async () => {
	await withTempDir('legacy-report-assets-', async (directory) => {
		const assets = join(directory, 'runs', 'run-001', 'assets');
		mkdirSync(assets, { recursive: true });
		writeFileSync(join(assets, 'summary.json'), '{"ok":true}');
		const repository = new LegacyReportRepository(directory);
		const bytes = await repository.asset('run-001', 'summary.json');
		const escaped = await repository.asset('run-001', '../manifest.json');

		expect(bytes?.toString('utf8')).toBe('{"ok":true}');
		expect(escaped).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'repository.legacy-report',
				symbol: 'asset',
				state: 'reads-asset-bytes-and-rejects-paths-outside-the-asset-direct',
				evidence: 'examples-cases',
				file: 'reads-asset-bytes-and-rejects-paths-outside-the-asset-direct.json'
			},
			[
				{
					name: 'existing asset bytes are returned without parsing',
					input: { run: 'run-001', file: 'summary.json' },
					output: '{"ok":true}'
				},
				{
					name: 'a path resolving outside assets is unavailable',
					input: { run: 'run-001', file: '../manifest.json' },
					output: null
				}
			]
		);
	});
});
