import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	regressionHash,
	regressionHistory,
	sameRegression,
	readRegression
} from '../../src/utils/git-source-history/regressionHistory';
import type {
	RegressionNote,
	Loaded
} from '../../src/utils/git-source-history/regressionHistory.types';
import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes.types';
import {
	note,
	redRecord,
	greenRecord,
	recordError,
	readBytes
} from './function.regression-history.fixtures';

test('Projects matching red and green regression checkpoints', async () => {
	const redNote = note(redRecord, 'red');
	const greenNote = note(greenRecord, 'green');
	const records = new Map<string, RegressionRecord>([
		[redRecord.id, redRecord],
		[greenRecord.id, greenRecord]
	]);
	const loaded = (record: RegressionRecord): Loaded => ({
		record,
		output:
			record.phase === 'red'
				? 'FAIL regressionHistory\nexpected 2 to equal 3\n'
				: 'PASS regressionHistory\n'
	});
	const load = async (item: RegressionNote) => loaded(records.get(item.record)!);
	const views = await regressionHistory(
		greenRecord.source.commit,
		new Map([
			[redRecord.source.commit, { entries: [redNote], problems: [] }],
			[greenRecord.source.commit, { entries: [greenNote], problems: [] }]
		]),
		load,
		{ place: async () => ({ media: null }) }
	);
	const result = {
		loop: views[0]?.loop,
		redCommit: views[0]?.red?.commit,
		redStatus: views[0]?.red?.status,
		greenCommit: views[0]?.green?.commit,
		greenStatus: views[0]?.green?.status
	};
	expect(result).toEqual({
		loop: 'loop-evidence-grid',
		redCommit: redRecord.source.commit,
		redStatus: 'failed',
		greenCommit: greenRecord.source.commit,
		greenStatus: 'passed'
	});
	expect(sameRegression(redRecord, greenRecord)).toBe(true);
	const cases = [
		{
			name: 'matching red checkpoint and passing fix',
			input: { selectedCommit: greenRecord.source.commit, red: redRecord, green: greenRecord },
			output: result
		},
		{
			name: 'hashes exact evidence bytes',
			input: 'FAIL regressionHistory\nexpected 2 to equal 3\n',
			output: regressionHash('FAIL regressionHistory\nexpected 2 to equal 3\n')
		}
	];
	recordExampleCases(
		{
			unitId: 'function.regression-history',
			symbol: 'regressionHistory',
			state: 'projects-matching-red-and-green-regression-checkpoints',
			evidence: 'examples-cases',
			file: 'projects-matching-red-and-green-regression-checkpoints.json'
		},
		cases
	);
});

test('Throws ExpectedCliError when regression evidence is missing', async () => {
	const redNote = note(redRecord, 'red');
	const read = async () => undefined;
	await expect(readRegression(redNote, read)).rejects.toThrow('Regression evidence is missing.');
	recordError(
		'throws-expectedclierror-when-regression-evidence-is-missing',
		'Regression evidence is missing.',
		{ note: redNote, files: 'missing' }
	);
});

test('Throws SyntaxError when the manifest is invalid JSON', async () => {
	const redNote = note(redRecord, 'red');
	const invalidJson = Buffer.from('{');
	const fixture = readBytes(
		'{}',
		JSON.stringify({
			record: regressionHash('{}'),
			log: regressionHash('FAIL regressionHistory\nexpected 2 to equal 3\n')
		})
	);
	const read = async (path: string) =>
		path === 'manifest.json' ? invalidJson : fixture.read(path);
	await expect(
		readRegression(
			{ ...redNote, evidence: { ...redNote.evidence, manifest: regressionHash(invalidJson) } },
			read
		)
	).rejects.toThrow(SyntaxError);
	recordError('throws-syntaxerror-when-the-manifest-is-invalid-json', 'SyntaxError', {
		path: 'manifest.json',
		bytes: '{'
	});
});

test('Throws regressionRecordSchema parse error when the record is invalid', async () => {
	const redNote = note(redRecord, 'red');
	const fixture = readBytes('{}');
	await expect(readRegression(redNote, fixture.read)).rejects.toThrow();
	recordError(
		'throws-regressionrecordschema-parse-error-when-the-record-is',
		'Schema validation error',
		{ path: 'record.json', bytes: '{}' }
	);
});

test('Passes through read callback rejection', async () => {
	const redNote = note(redRecord, 'red');
	const failure = new Error('fixture read failed');
	const read = async () => {
		throw failure;
	};
	await expect(readRegression(redNote, read)).rejects.toBe(failure);
	recordError('passes-through-read-callback-rejection', failure.message, {
		note: redNote,
		rejection: failure.message
	});
});

test('Reports Invalid proof when a regression loader rejects', async () => {
	const redNote = note(redRecord, 'red');
	const views = await regressionHistory(
		redRecord.source.commit,
		new Map([[redRecord.source.commit, { entries: [redNote], problems: [] }]]),
		async () => {
			throw new Error('Regression evidence is missing.');
		}
	);
	expect(views[0]?.gap).toBe('Regression evidence is missing.');
	recordExampleCases(
		{
			unitId: 'function.regression-history',
			symbol: 'regressionHistory',
			state: 'reports-invalid-proof-when-a-regression-loader-rejects',
			evidence: 'examples-cases',
			file: 'reports-invalid-proof-when-a-regression-loader-rejects.json'
		},
		[
			{
				name: 'loader rejection becomes a note gap',
				input: { commit: redRecord.source.commit, error: 'Regression evidence is missing.' },
				output: { units: [], red: null, gap: 'Regression evidence is missing.' }
			}
		]
	);
});
