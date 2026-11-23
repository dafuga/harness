import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { SiteReportRepository } from '../../src/routes/api/health/SiteReportRepository';

const localId = '3f0c9a52-6b1e-4d7a-8f2e-b5c1d9a04e77';
const foreignId = 'c81d4e2a-0f3b-4a6c-9d17-2e5b8f63a1d0';

function report(id: string, projectPath: string) {
	return {
		schemaVersion: 1,
		id,
		project: { id: '9b7e2c4f1a8d3e60', name: 'harness-site', path: projectPath },
		title: 'Checkout flow',
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt: '2026-11-12T09:14:03.218Z',
		updatedAt: '2026-11-12T09:14:03.218Z',
		summary: '',
		status: 'running',
		state: 'active',
		checks: [],
		evidence: [],
		findings: [],
		coverage: [],
		acceptance: []
	};
}

function writeReport(root: string, id: string, projectPath: string) {
	const directory = join(root, 'runs', id);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, 'manifest.json'), JSON.stringify(report(id, projectPath)));
}

test('Returns a report owned by this site', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'site-report-owned-'));
	try {
		writeReport(directory, localId, process.cwd());
		const result = await new SiteReportRepository(directory).get(localId);
		expect(result.id).toBe(localId);
		recordExampleCases(
			{
				unitId: 'reports.repository.site-report',
				symbol: 'get',
				state: 'returns-a-report-owned-by-this-site',
				evidence: 'examples-cases',
				file: 'returns-a-report-owned-by-this-site.json'
			},
			[
				{
					name: 'checkout report belongs to the current repository',
					input: { id: localId },
					output: { id: result.id, title: result.title, projectPath: result.project.path }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects a report owned by another site', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'site-report-foreign-'));
	try {
		writeReport(directory, foreignId, directory);
		let error: unknown;
		try {
			await new SiteReportRepository(directory).get(foreignId);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('ENOENT: no such report on this site');
		recordExampleCases(
			{
				unitId: 'reports.repository.site-report',
				symbol: 'get',
				state: 'rejects-a-report-owned-by-another-site',
				evidence: 'examples-cases',
				file: 'rejects-a-report-owned-by-another-site.json'
			},
			[
				{
					name: 'report from an unrelated directory reads as absent',
					input: { id: foreignId },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
