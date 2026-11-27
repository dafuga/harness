import type { RuntimeEnvironment } from '../../src/core/execution-runtimes/runtimeTypes.types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	evidenceRequested,
	recordCapture
} from '../../src/utils/reports-media/record-capture/recordCapture';

import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Evidence recording requires both opt-in settings', () => {
	const requested: RuntimeEnvironment = {
		HARNESS_EVIDENCE_DIR: '.cache/harness/evidence',
		TAKE_SCREENSHOT: '1'
	};
	const alternate: RuntimeEnvironment = {
		HARNESS_EVIDENCE_DIR: '.cache/harness/evidence',
		TAKE_SCREENSHOT: 'true'
	};
	const results = [evidenceRequested(requested), evidenceRequested(alternate)];
	expect(results).toEqual([true, false]);
	recordExampleCases(
		{
			unitId: 'function.record-capture',
			symbol: 'evidenceRequested',
			state: 'evidence-recording-requires-both-opt-in-settings',
			evidence: 'examples-cases',
			file: 'evidence-recording-requires-both-opt-in-settings.json'
		},
		[
			{ name: 'evidence directory and screenshot opt-in are set', input: requested, output: true },
			{
				name: 'nonempty directory has a nonmatching screenshot value',
				input: alternate,
				output: false
			}
		]
	);
});

test('Requested captures write bytes and append their metadata', async () => {
	await withTempDir('record-capture-', (directory) => {
		const env = { HARNESS_EVIDENCE_DIR: directory, TAKE_SCREENSHOT: '1' };
		const line = {
			evidence: 'reports.component.evidence-grid',
			kind: 'output' as const,
			state: 'reports.capture-grid.ready',
			file: 'verification-output.txt',
			mediaType: 'text/plain'
		};
		const bytes = 'Rendered verification output.\n';
		const recorded = recordCapture(line, bytes, env);
		const content = readFileSync(join(directory, line.file), 'utf8');
		const index = readFileSync(join(directory, 'captures.ndjson'), 'utf8');
		expect({ recorded, content, index }).toEqual({
			recorded: true,
			content: bytes,
			index: `${JSON.stringify(line)}\n`
		});
		recordExampleCases(
			{
				unitId: 'function.record-capture',
				symbol: 'recordCapture',
				state: 'requested-captures-write-bytes-and-append-their-metadata',
				evidence: 'examples-cases',
				file: 'requested-captures-write-bytes-and-append-their-metadata.json'
			},
			[
				{
					name: 'requested text output is written and indexed',
					input: { line, bytes, env },
					output: { recorded, content, index }
				}
			]
		);
	});
});

test('Throws Error when capture file parent is missing', async () => {
	await withTempDir('record-capture-error-', (directory) => {
		const env = { HARNESS_EVIDENCE_DIR: directory, TAKE_SCREENSHOT: '1' };
		const line = {
			evidence: 'reports.component.evidence-grid',
			kind: 'output' as const,
			state: 'reports.capture-grid.ready',
			file: 'missing/verification-output.txt',
			mediaType: 'text/plain'
		};
		const bytes = 'Rendered verification output.\n';
		let error: unknown;
		try {
			recordCapture(line, bytes, env);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		const result = error instanceof Error ? { name: error.name, message: error.message } : null;
		recordExampleCases(
			{
				unitId: 'function.record-capture',
				symbol: 'recordCapture',
				state: 'throws-error-when-capture-file-parent-is-missing',
				evidence: 'examples-cases',
				file: 'throws-error-when-capture-file-parent-is-missing.json'
			},
			[
				{
					name: 'capture write failure propagates',
					input: { line, bytes, env },
					error: result
				}
			]
		);
	});
});
