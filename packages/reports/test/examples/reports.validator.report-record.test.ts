import type { RecordInput } from '../../src/models/reports-media/Report.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportRecordValidator } from '../../src/validators/reports-media/ReportRecordValidator';

const validRecords: RecordInput[] = [
	{ kind: 'heartbeat', data: {} },
	{ kind: 'summary', data: { text: 'Build and browser verification passed.' } },
	{
		kind: 'check',
		data: { id: 'check-browser-smoke', title: 'Browser smoke check', status: 'passed' }
	}
];

function thrownBy(record: unknown): { name: string; message: string } {
	let error: unknown;
	try {
		ReportRecordValidator.validate(record as RecordInput);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

function rejected(name: string, record: unknown) {
	return { name, input: record, error: thrownBy(record) };
}

test('Accepts heartbeat, summary, and passing check records', () => {
	const cases = validRecords.map((record) => {
		const output = ReportRecordValidator.validate(record);
		expect(output).toBeUndefined();
		return {
			name: `accepts ${record.kind} record`,
			input: record,
			output: { accepted: true }
		};
	});

	recordExampleCases(
		{
			unitId: 'reports.validator.report-record',
			symbol: 'validate',
			state: 'accepts-heartbeat-summary-and-passing-check-records',
			evidence: 'examples-cases',
			file: 'accepts-heartbeat-summary-and-passing-check-records.json'
		},
		cases
	);
});

test('Rejects unsupported kinds, missing data and bad summaries', () => {
	const cases = [
		rejected('rejects unknown kind', { kind: 'note', data: {} }),
		rejected('rejects check with array data', { kind: 'check', data: [] }),
		rejected('rejects summary without text', { kind: 'summary', data: { text: 42 } }),
		rejected('rejects check with blank title', {
			kind: 'check',
			data: { id: 'check-1', title: '   ', status: 'passed' }
		})
	];
	expect(cases[0].error.message).toBe('Unsupported record kind');
	expect(cases[2].error.message).toBe('Summary text is required');

	recordExampleCases(
		{
			unitId: 'reports.validator.report-record',
			symbol: 'validate',
			state: 'rejects-unsupported-kinds-missing-data-and-bad-summaries',
			evidence: 'examples-cases',
			file: 'rejects-unsupported-kinds-missing-data-and-bad-summaries.json'
		},
		cases
	);
});

test('Rejects bad acceptance, evidence, and audio fields', () => {
	const cases = [
		rejected('rejects blank acceptance criterion', {
			kind: 'acceptance',
			data: { items: [''] }
		}),
		rejected('rejects evidence without path', {
			kind: 'evidence',
			data: { id: 'shot-1', title: 'Login screenshot' }
		}),
		rejected('rejects unknown evidence phase', {
			kind: 'evidence',
			data: { id: 'shot-1', title: 'Login screenshot', path: 'shots/login.png', phase: 'later' }
		}),
		rejected('rejects negative audio duration', {
			kind: 'evidence',
			data: { id: 'clip-1', title: 'Narration', path: 'clips/a.wav', durationSeconds: -1 }
		}),
		rejected('rejects non-string audio transcript', {
			kind: 'evidence',
			data: { id: 'clip-1', title: 'Narration', path: 'clips/a.wav', transcript: 12 }
		}),
		rejected('rejects unknown check status', {
			kind: 'check',
			data: { id: 'check-1', title: 'Smoke', status: 'done' }
		}),
		rejected('rejects unsafe record id', {
			kind: 'check',
			data: { id: 'bad id!', title: 'Smoke', status: 'passed' }
		})
	];
	expect(cases[5].error.message).toBe('Valid status is required');

	recordExampleCases(
		{
			unitId: 'reports.validator.report-record',
			symbol: 'validate',
			state: 'rejects-bad-acceptance-evidence-and-audio-fields',
			evidence: 'examples-cases',
			file: 'rejects-bad-acceptance-evidence-and-audio-fields.json'
		},
		cases
	);
});
