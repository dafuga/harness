import { test } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { artifactCases, caseForm } from '../packages/reports/src/utils/explorer-ui/artifactCases';
import { captureIndex, captureLineSchema } from '../src/core/verification-evidence/verifyTypes';
import { recordExampleCases } from './support/recordExampleCases';
import { withTempDir } from './support/temporary';
import { expect } from './verificationExpect';

const unitId = 'test.function.example-cases';
const symbol = 'recordExampleCases';
const state = 'recorded';
const evidence = 'example-cases';
const file = 'example-cases.json';
const example = { name: 'zero input', input: 0, output: { value: 0 } };

test('records function examples as a trace that the explorer reads as cases', async () => {
	await withTempDir('example-cases-', (directory) => {
		const env = { HARNESS_EVIDENCE_DIR: directory, TAKE_SCREENSHOT: '1' };
		recordExampleCases({ unitId, symbol, state, evidence, file }, [example], env);

		const lines = readFileSync(join(directory, captureIndex), 'utf8').trim().split('\n');
		expect(lines).toHaveLength(1);
		expect(captureLineSchema.parse(JSON.parse(lines[0]))).toEqual({
			evidence,
			kind: 'trace',
			state,
			file,
			mediaType: 'application/json'
		});
		const document = JSON.parse(readFileSync(join(directory, file), 'utf8'));
		expect(artifactCases(document, unitId).kind).toBe('cases');
		expect(artifactCases(document, unitId)).toMatchObject({
			kind: 'cases',
			source: 'invocations',
			symbol,
			cases: [{ name: example.name, input: example.input, output: example.output, failed: false }]
		});
	});
});

test('does not write when evidence capture is not enabled', async () => {
	await withTempDir('example-cases-', (directory) => {
		expect(recordExampleCases({ unitId, symbol, state, evidence, file }, [example], {})).toBe(
			false
		);
		expect(existsSync(join(directory, captureIndex))).toBe(false);
		expect(existsSync(join(directory, file))).toBe(false);
	});
});

test('rejects cases beyond the recorded form limits', async () => {
	await withTempDir('example-cases-', (directory) => {
		const env = { HARNESS_EVIDENCE_DIR: directory, TAKE_SCREENSHOT: '1' };
		expect(() =>
			recordExampleCases(
				{ unitId, symbol, state, evidence, file },
				Array.from({ length: caseForm.most + 1 }, (_, index) => ({
					...example,
					name: `case-${index}`
				})),
				env
			)
		).toThrow(RangeError);
		expect(() =>
			recordExampleCases(
				{ unitId, symbol, state, evidence, file },
				[{ ...example, name: 'x'.repeat(caseForm.name + 1) }],
				env
			)
		).toThrow(RangeError);
		expect(existsSync(join(directory, captureIndex))).toBe(false);
	});
});
