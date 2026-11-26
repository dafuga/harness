import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { MiraReportAdapter } from '../../src/services/reports-media/report-command-service/MiraReportAdapter';
import type {
	MiraAsset,
	MiraFinding
} from '../../src/services/reports-media/report-command-service/MiraReportAdapter.types';
import type { Written, Store } from './reports.adapter.mira-report.test.types';

const assets: MiraAsset[] = [
	{
		number: 1,
		file: 'shots/intro.png',
		caption: 'Intro screen',
		category: 'ui',
		source: 'production',
		capturedAt: '2026-01-05T10:00:00Z'
	},
	{ number: 2, file: 'shots/level.png', caption: 'Level start', category: 'gameplay' }
];

const findings = {
	scenesPlayed: 3,
	requestedScenes: 4,
	issues: [
		{ id: 'audio-cut-out', status: 'unresolved', detail: 'Audio drops at scene 3' }
	] satisfies MiraFinding[]
};

function writeJson(directory: string, name: string, value: unknown): string {
	const file = join(directory, name);
	writeFileSync(file, JSON.stringify(value));
	return file;
}

function fakeStore(written: Written[]): Store {
	return {
		record: async (id: string, record: Written['record']) => {
			written.push({ id, record });
		}
	} as unknown as Store;
}

function summarise(written: Written[]) {
	return written.map(({ id, record }) => ({
		reportId: id,
		kind: record.kind,
		id: record.data.id,
		status: record.data.status
	}));
}

test('ingest imports assets, findings and coverage into the store', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'mira-report-examples-'));
	try {
		const assetsFile = writeJson(directory, 'mira-assets.json', assets);
		const findingsFile = writeJson(directory, 'mira-findings.json', findings);
		const written: Written[] = [];
		const result = await new MiraReportAdapter().ingest(
			fakeStore(written),
			'report-123',
			assetsFile,
			findingsFile
		);
		expect(result).toEqual({ evidence: 2 });
		expect(written).toHaveLength(5);
		expect(written[0].record.data.path).toBe(join(directory, 'shots/intro.png'));
		recordExampleCases(
			{
				unitId: 'reports.adapter.mira-report',
				symbol: 'MiraReportAdapter.ingest',
				state: 'ingest-imports-assets-findings-and-coverage-into-the-store',
				evidence: 'examples-cases',
				file: 'ingest-imports-assets-findings-and-coverage-into-the-store.json'
			},
			[
				{
					name: 'two assets, one unresolved issue and 3 of 4 scenes',
					input: { id: 'report-123', assets, findings },
					output: { result, records: summarise(written) }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('ingest rejects malformed assets JSON', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'mira-report-examples-'));
	try {
		const assetsFile = join(directory, 'mira-assets.json');
		const content = '[{"number": 1,';
		writeFileSync(assetsFile, content);
		const written: Written[] = [];
		await expect(
			new MiraReportAdapter().ingest(fakeStore(written), 'report-123', assetsFile)
		).rejects.toThrow(SyntaxError);
		expect(written).toHaveLength(0);
		recordExampleCases(
			{
				unitId: 'reports.adapter.mira-report',
				symbol: 'MiraReportAdapter.ingest',
				state: 'ingest-rejects-malformed-assets-json',
				evidence: 'examples-cases',
				file: 'ingest-rejects-malformed-assets-json.json'
			},
			[
				{
					name: 'truncated assets file raises SyntaxError and records nothing',
					input: { id: 'report-123', file: 'mira-assets.json', content },
					error: { name: 'SyntaxError', recordsWritten: 0 }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
