import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';

const input = {
	project: '/tmp/reports-demo',
	title: 'Report contract example',
	mode: 'feature' as const,
	environment: 'local',
	revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	historical: false,
	summary: 'Acceptance checks are recorded.',
	acceptance: ['Review the generated report']
};
function makeRepository() {
	const root = mkdtempSync(join(tmpdir(), 'report-repository-'));
	return { root, repository: new ReportRepository(root) };
}

test('Creates and reloads a report manifest', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		const loaded = await repository.get(created.id);
		const listed = await repository.list();
		expect(loaded.id).toBe(created.id);
		expect(listed.map((run) => run.id)).toContain(created.id);
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'begin/get/list', state: 'creates-and-reloads-a-report-manifest', evidence: 'examples-cases', file: 'creates-and-reloads-a-report-manifest.json' },
			[{ name: 'begin persists a report that get and list return', input: { begin: input }, output: { id: created.id, title: loaded.title, state: loaded.state, listed: listed.length } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Records a summary on an active report', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		const updated = await repository.record(created.id, { kind: 'summary', data: { text: 'All required checks passed.' } });
		expect(updated.summary).toBe('All required checks passed.');
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'record', state: 'records-a-summary-on-an-active-report', evidence: 'examples-cases', file: 'records-a-summary-on-an-active-report.json' },
			[{ name: 'summary record updates active report', input: { id: created.id, record: { kind: 'summary', data: { text: 'All required checks passed.' } } }, output: { summary: updated.summary, state: updated.state } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Mutates an active report', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		const updated = await repository.mutateActive(created.id, async (run) => { run.summary = 'Updated by callback.'; });
		expect(updated.summary).toBe('Updated by callback.');
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'mutateActive', state: 'mutates-an-active-report', evidence: 'examples-cases', file: 'mutates-an-active-report.json' },
			[{ name: 'callback mutation is persisted', input: { id: created.id, summary: 'Updated by callback.' }, output: { summary: updated.summary, state: updated.state } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Seals an active report', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		const sealed = await repository.seal(created.id);
		expect(sealed.state).toBe('finalizing');
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'seal', state: 'seals-an-active-report', evidence: 'examples-cases', file: 'seals-an-active-report.json' },
			[{ name: 'seal transitions report to finalizing', input: { id: created.id }, output: { state: sealed.state, status: sealed.status } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Finishes a finalizing report', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		await repository.seal(created.id);
		const finished = await repository.finish(created.id);
		expect(finished.state).toBe('finalized');
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'finish', state: 'finishes-a-finalizing-report', evidence: 'examples-cases', file: 'finishes-a-finalizing-report.json' },
			[{ name: 'finish transitions report to finalized', input: { id: created.id }, output: { state: finished.state, status: finished.status } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
