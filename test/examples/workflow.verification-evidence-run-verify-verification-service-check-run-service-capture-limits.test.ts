import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { digestFile, oversizeCapture, RecordBudget } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits';
import type { CaptureLimits } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits.types';

const unitId = 'workflow.verification-evidence-run-verify-verification-service-check-run-service-capture-limits';
const abc = 'abc';
const abcSha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const limitMessage = 'Capture exceeded maxCaptureBytes or remaining maxRecordBytes while reading.';
const regularMessage = 'Capture must be a regular file.';
const limits: CaptureLimits = { maxCaptureBytes: 1048576, maxRecordBytes: 4194304 };

function writeCapture(directory: string, text: string): string {
	const path = join(directory, 'check.log');
	writeFileSync(path, text);
	return path;
}

function thrownBy(run: () => unknown): { name: string; message: string } | undefined {
	try {
		run();
	} catch (caught) {
		const { name, message } = caught as Error;
		return { name, message };
	}
	return undefined;
}

test('Digests a capture file with its sha256 and byte count', async () => {
	await withTempDir('capture-limits-digest-', (directory) => {
		const output = digestFile(writeCapture(directory, abc));
		expect(output).toEqual({ sha256: abcSha, bytes: 3 });
		recordExampleCases(
			{
				unitId,
				symbol: 'digestFile',
				state: 'digests-a-capture-file-with-its-sha256-and-byte-count',
				evidence: 'examples-cases',
				file: 'digests-a-capture-file-with-its-sha256-and-byte-count.json'
			},
			[{ name: 'three-byte capture without a ceiling', input: { content: abc }, output }]
		);
	});
});

test('Returns the capture contents only when retain is requested', async () => {
	await withTempDir('capture-limits-retain-', (directory) => {
		const path = writeCapture(directory, abc);
		const retained = digestFile(path, undefined, true);
		const streamed = digestFile(path);
		expect(retained.contents?.toString('utf8')).toBe(abc);
		expect(streamed).not.toHaveProperty('contents');
		recordExampleCases(
			{
				unitId,
				symbol: 'digestFile',
				state: 'returns-the-capture-contents-only-when-retain-is-requested',
				evidence: 'examples-cases',
				file: 'returns-the-capture-contents-only-when-retain-is-requested.json'
			},
			[
				{
					name: 'retain true keeps the bytes',
					input: { retain: true },
					output: { sha256: retained.sha256, bytes: retained.bytes, contents: abc }
				},
				{
					name: 'retain omitted keeps no bytes',
					input: { retain: false },
					output: { sha256: streamed.sha256, bytes: streamed.bytes }
				}
			]
		);
	});
});

test('Refuses a capture read past its byte ceiling', async () => {
	await withTempDir('capture-limits-ceiling-', (directory) => {
		const path = writeCapture(directory, abc);
		const error = thrownBy(() => digestFile(path, 2));
		expect(error).toEqual({ name: 'CaptureReadError', message: limitMessage });
		expect(digestFile(path, 3).bytes).toBe(3);
		recordExampleCases(
			{
				unitId,
				symbol: 'digestFile',
				state: 'refuses-a-capture-read-past-its-byte-ceiling',
				evidence: 'examples-cases',
				file: 'refuses-a-capture-read-past-its-byte-ceiling.json'
			},
			[
				{ name: 'three-byte file with a two-byte ceiling', input: { maxBytes: 2 }, error },
				{ name: 'three-byte file with a three-byte ceiling', input: { maxBytes: 3 }, output: { bytes: 3 } }
			]
		);
	});
});

test('Refuses a capture path that is not a regular file', async () => {
	await withTempDir('capture-limits-directory-', (directory) => {
		const error = thrownBy(() => digestFile(directory));
		expect(error).toEqual({ name: 'CaptureReadError', message: regularMessage });
		recordExampleCases(
			{
				unitId,
				symbol: 'digestFile',
				state: 'refuses-a-capture-path-that-is-not-a-regular-file',
				evidence: 'examples-cases',
				file: 'refuses-a-capture-path-that-is-not-a-regular-file.json'
			},
			[{ name: 'directory path is refused', input: { path: 'checks' }, error }]
		);
	});
});

test('Refuses a capture over maxCaptureBytes per file', () => {
	const refusal = oversizeCapture('checks/unit.log', 2097152, limits);
	const atCap = oversizeCapture('checks/unit.log', 1048576, limits);
	expect(refusal).toBe(
		'left capture checks/unit.log of 2097152 bytes, over maxCaptureBytes 1048576 in harness.verify.json; it was not recorded'
	);
	expect(atCap).toBeUndefined();
	expect(oversizeCapture('checks/unit.log', 2097152, {})).toBeUndefined();
	recordExampleCases(
		{
			unitId,
			symbol: 'oversizeCapture',
			state: 'refuses-a-capture-over-maxcapturebytes-per-file',
			evidence: 'examples-cases',
			file: 'refuses-a-capture-over-maxcapturebytes-per-file.json'
		},
		[
			{
				name: 'two MiB capture against a one MiB cap',
				input: { file: 'checks/unit.log', bytes: 2097152, limits },
				output: { refusal }
			},
			{
				name: 'capture exactly at the cap is not refused',
				input: { file: 'checks/unit.log', bytes: 1048576, limits },
				output: { refusal: atCap ?? null }
			},
			{
				name: 'no maxCaptureBytes means no refusal',
				input: { file: 'checks/unit.log', bytes: 2097152, limits: {} },
				output: { refusal: null }
			}
		]
	);
});

test('Refuses a record admission that would exceed maxRecordBytes', () => {
	const budget = new RecordBudget(8192);
	budget.retain(4096);
	const fits = budget.refusal('checks/unit.log', 4096);
	const refusal = budget.refusal('checks/typecheck.log', 8192);
	const unbounded = new RecordBudget();
	expect(budget.remaining()).toBe(4096);
	expect(fits).toBeUndefined();
	expect(refusal).toBe(
		'left capture checks/typecheck.log of 8192 bytes, which takes the record to 12288 bytes, over maxRecordBytes 8192 in harness.verify.json; it was not recorded'
	);
	expect(unbounded.refusal('checks/typecheck.log', 8192)).toBeUndefined();
	expect(unbounded.remaining()).toBeUndefined();
	recordExampleCases(
		{
			unitId,
			symbol: 'RecordBudget.refusal',
			state: 'refuses-a-record-admission-that-would-exceed-maxrecordbytes',
			evidence: 'examples-cases',
			file: 'refuses-a-record-admission-that-would-exceed-maxrecordbytes.json'
		},
		[
			{
				name: 'capture that exactly fills the record is admitted',
				input: { max: 8192, retained: 4096, path: 'checks/unit.log', bytes: 4096 },
				output: { refusal: fits ?? null }
			},
			{
				name: 'capture that overflows the record is refused',
				input: { max: 8192, retained: 4096, path: 'checks/typecheck.log', bytes: 8192 },
				output: { refusal }
			},
			{
				name: 'unbounded record never refuses',
				input: { max: null, path: 'checks/typecheck.log', bytes: 8192 },
				output: { refusal: null, remaining: null }
			}
		]
	);
});
