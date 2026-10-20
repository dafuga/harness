import { expect, test } from 'vitest';
import { legacyRecordSchema } from '../../src/core/historyTypes';
import { legacyReport } from '../../src/services/legacy-import-service/legacyReport';

const manifest = {
	schemaVersion: 1,
	id: 'run-1',
	project: { id: 'demo', name: 'Demo', path: '/Users/someone/projects/demo' },
	title: 'Checkout flow',
	mode: 'feature',
	environment: 'local',
	historical: false,
	startedAt: '2026-10-07T09:00:00.000Z',
	updatedAt: '2026-10-07T09:10:00.000Z',
	summary: 'Still going.',
	status: 'running',
	state: 'active',
	checks: [
		{
			id: 'unit',
			title: 'Unit',
			status: 'passed',
			command: 'bun test',
			output: '/Users/someone/secret'
		}
	],
	evidence: [
		{
			id: 'shot',
			title: 'Page',
			category: 'ui',
			file: 'page.png',
			status: 'passed',
			mimeType: 'image/png',
			capturedAt: '2026-10-07T09:05:00.000Z',
			source: '/Users/someone/page.png'
		}
	],
	findings: [],
	coverage: [],
	acceptance: []
};

test('legacyReport keeps the run as recorded: running stays running and no revision stays null', () => {
	const report = legacyReport(manifest);
	expect(legacyRecordSchema.safeParse(report?.record).success).toBe(true);
	expect(report?.record).toMatchObject({
		id: 'run-1',
		status: 'running',
		state: 'active',
		startedAt: '2026-10-07T09:00:00.000Z',
		updatedAt: '2026-10-07T09:10:00.000Z',
		revision: null
	});
	expect(legacyReport({ ...manifest, revision: ' abc1234 ' })?.record.revision).toBe('abc1234');
	expect(report?.project.path).toBe('/Users/someone/projects/demo');
});

test('legacyReport carries media provenance and drops local paths, commands and logs', () => {
	const record = legacyReport(manifest)?.record;
	expect(record?.media).toEqual([
		{
			id: 'shot',
			title: 'Page',
			file: 'page.png',
			status: 'passed',
			mediaType: 'image/png',
			capturedAt: '2026-10-07T09:05:00.000Z',
			provenance: 'legacy-report',
			sha256: null,
			bytes: null
		}
	]);
	expect(record?.checks).toEqual([{ id: 'unit', title: 'Unit', status: 'passed' }]);
	expect(JSON.stringify(record)).not.toContain('/Users/someone');
});

test('legacyReport refuses what is not a report manifest', () => {
	expect(legacyReport({ id: 'x' })).toBeUndefined();
	expect(legacyReport('text')).toBeUndefined();
});
