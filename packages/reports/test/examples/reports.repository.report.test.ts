import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test('Throws Error when a report ID is invalid', async () => {
	const { root, repository } = makeRepository();
	try {
		await expect(repository.get('../outside')).rejects.toBeInstanceOf(Error);
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'get', state: 'throws-error-when-a-report-id-is-invalid', evidence: 'examples-cases', file: 'throws-error-when-a-report-id-is-invalid.json' },
			[{ name: 'unsafe report ID is rejected', input: { id: '../outside' }, error: 'Error' }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws SyntaxError when a stored manifest is invalid JSON', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		writeFileSync(join(repository.directory(created.id), 'manifest.json'), '{invalid');
		await expect(repository.get(created.id)).rejects.toBeInstanceOf(SyntaxError);
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'get', state: 'throws-syntaxerror-when-a-stored-manifest-is-invalid-json', evidence: 'examples-cases', file: 'throws-syntaxerror-when-a-stored-manifest-is-invalid-json.json' },
			[{ name: 'malformed manifest cannot be parsed', input: { id: created.id, manifest: '{invalid' }, error: 'SyntaxError' }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws TypeError when list sorts invalid startedAt', async () => {
	const { root, repository } = makeRepository();
	try {
		const created = await repository.begin(input);
		const other = await repository.begin({ ...input, title: 'Second report' });
		for (const run of [created, other])
			writeFileSync(join(repository.directory(run.id), 'manifest.json'), JSON.stringify({ ...run, startedAt: 1 }));
		await expect(repository.list()).rejects.toBeInstanceOf(TypeError);
		recordExampleCases(
			{ unitId: 'reports.repository.report', symbol: 'list', state: 'throws-typeerror-when-list-sorts-invalid-startedat', evidence: 'examples-cases', file: 'throws-typeerror-when-list-sorts-invalid-startedat.json' },
			[{ name: 'non-string startedAt fails report sorting', input: { id: created.id, startedAt: 1 }, error: 'TypeError' }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
