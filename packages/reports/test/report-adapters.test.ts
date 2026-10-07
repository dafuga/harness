import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { ReportImportService } from '../src/services/ReportImportService';
const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'report-adapter-'));
	roots.push(root);
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/adapter-project',
		title: 'Runner proof',
		mode: 'suite',
		environment: 'local'
	});
	return { root, store, run };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('Playwright and Vitest imports retain failed and skipped tests without exposing raw runner data', async () => {
	const { root, store, run } = await fixture();
	const playwright = join(root, 'playwright.json');
	await writeFile(
		playwright,
		JSON.stringify({
			suites: [
				{
					specs: [
						{
							title: 'Saving form',
							tests: [
								{
									status: 'unexpected',
									results: [{ status: 'failed', duration: 115, attachments: [] }]
								}
							]
						},
						{
							title: 'Pending device',
							tests: [{ status: 'skipped', results: [{ status: 'skipped', duration: 0 }] }]
						}
					]
				}
			],
			metadata: { authorization: 'Bearer secret-value' }
		})
	);
	const vitest = join(root, 'vitest.json');
	await writeFile(
		vitest,
		JSON.stringify({
			testResults: [
				{
					name: 'settings.test.ts',
					assertionResults: [
						{ fullName: 'renders saved settings', status: 'passed', duration: 12 },
						{ fullName: 'rejects invalid input', status: 'failed', duration: 3 }
					]
				}
			]
		})
	);
	const importer = new ReportImportService(store);
	await importer.ingest('playwright', run.id, playwright);
	await importer.ingest('vitest', run.id, vitest);
	const result = await store.get(run.id);
	expect(result.checks.map((item) => item.status)).toEqual([
		'failed',
		'skipped',
		'passed',
		'failed'
	]);
	expect(JSON.stringify(result)).not.toContain('secret-value');
});
test('command outcomes and manual records retain provenance and redact secrets', async () => {
	const { root, store, run } = await fixture();
	const file = join(root, 'command.json');
	await writeFile(
		file,
		JSON.stringify({
			title: 'bun test',
			exitCode: 1,
			command: 'bun test',
			output: 'token=secret123 failure'
		})
	);
	await new ReportImportService(store).ingest('command', run.id, file);
	const check = (await store.get(run.id)).checks[0];
	expect(check.status).toBe('failed');
	expect(check.output).not.toContain('secret123');
});
