import type { ExampleCase } from './workflow.generate-unit.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { generateUnit } from '../../src/cli/program/generateUnit';
import type { GenerateUnitInput } from '../../src/cli/program/generateUnit.types';

async function captureError(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (caught) {
		return caught;
	}
	return undefined;
}

function errorSummary(error: unknown): { name: string; message: string } {
	const failure = error as Error;
	return { name: failure.name, message: failure.message };
}

function record(state: string, cases: ExampleCase[]): boolean {
	return recordExampleCases(
		{
			unitId: 'workflow.generate-unit',
			symbol: 'generateUnit',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Generates a function unit with its declared responsibility', async () => {
	await withTempRepo(async (repository) => {
		const input: GenerateUnitInput = {
			name: 'format-row-count',
			kind: 'function',
			responsibility: '  Trims and normalizes row labels for the evidence grid.  ',
			root: repository.root
		};
		const result = await generateUnit(input);
		const manifest = result.writes.find((write) => write.path.startsWith('specification/units/'));
		const parsed = JSON.parse(manifest?.contents ?? '{}') as { responsibility?: string };

		expect(result.kind).toBe('unit');
		expect(result.name).toBe('format-row-count');
		expect(manifest?.status).toBe('created');
		expect(parsed.responsibility).toBe('Trims and normalizes row labels for the evidence grid.');

		record('generates-a-function-unit-with-its-declared-responsibility', [
			{
				name: 'function unit with padded responsibility',
				input: {
					name: input.name,
					kind: input.kind,
					responsibility: input.responsibility
				},
				output: {
					kind: result.kind,
					name: result.name,
					exportsUpdated: result.exportsUpdated,
					writes: result.writes.map((write) => ({ path: write.path, status: write.status })),
					responsibility: parsed.responsibility
				}
			}
		]);
	});
});

test('Rejects an unsupported unit kind', async () => {
	await withTempDir('generate-unit-kind-', async (directory) => {
		const error = await captureError(
			generateUnit({ name: 'format-row-count', kind: 'resource', root: directory })
		);

		expect(error).toBeInstanceOf(Error);
		expect(errorSummary(error).message).toContain('Unsupported unit kind "resource"');

		record('rejects-an-unsupported-unit-kind', [
			{
				name: 'resource kind is not a unit kind',
				input: { name: 'format-row-count', kind: 'resource' },
				error: errorSummary(error)
			}
		]);
	});
});

test('Rejects a unit name with invalid characters', async () => {
	await withTempDir('generate-unit-name-', async (directory) => {
		const error = await captureError(generateUnit({ name: '-bad/name', root: directory }));

		expect(error).toBeInstanceOf(Error);

		record('rejects-a-unit-name-with-invalid-characters', [
			{
				name: 'name starting with a dash and containing a slash',
				input: { name: '-bad/name' },
				error: errorSummary(error)
			}
		]);
	});
});
