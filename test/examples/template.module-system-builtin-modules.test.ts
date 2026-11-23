import type { EvaluationOutcome } from './template.module-system-builtin-modules.test.types';
import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { builtinModules } from '../../src/templates/module-system/builtinModules';
import { standardCodeModules } from '../../src/templates/module-system/standardCodeModules';
import { testingPlugins } from '../../src/templates/module-system/testingPlugins';

const FIXED_MODULE_COUNT = 4;

function bundledRanges() {
	const standardEnd = standardCodeModules.length;
	const testingEnd = standardEnd + testingPlugins.length;
	return { standardEnd, testingEnd, total: testingEnd + FIXED_MODULE_COUNT };
}

function bundledCases() {
	const { standardEnd, testingEnd, total } = bundledRanges();
	return [
		{
			name: 'standardCodeModules block is first',
			input: { block: 'standardCodeModules', size: standardCodeModules.length },
			output: { start: 0, end: standardEnd }
		},
		{
			name: 'testingPlugins block follows the standard block',
			input: { block: 'testingPlugins', size: testingPlugins.length },
			output: { start: standardEnd, end: testingEnd }
		},
		{
			name: 'fixed modules close the list after the plugin block',
			input: {
				block: 'emailModule, offlineModule, rustWasmModule, rustBackendModule',
				size: FIXED_MODULE_COUNT
			},
			output: { start: testingEnd, end: total, admitted: builtinModules.length }
		}
	];
}

test('Admits every bundled capability in order', () => {
	const { total } = bundledRanges();
	expect(Array.isArray(builtinModules)).toBe(true);
	expect(builtinModules.length).toBe(total);
	expect(
		builtinModules.every((definition) => typeof definition === 'object' && definition !== null)
	).toBe(true);
	recordExampleCases(
		{
			unitId: 'template.module-system-builtin-modules',
			symbol: 'builtinModules',
			state: 'admits-every-bundled-capability-in-order',
			evidence: 'examples-cases',
			file: 'admits-every-bundled-capability-in-order.json'
		},
		bundledCases()
	);
});

async function evaluateWithInvalidEmailEntry(): Promise<EvaluationOutcome> {
	vi.resetModules();
	vi.doMock('../../src/templates/module-system/emailModule', () => ({
		emailModule: 'not-a-definition'
	}));
	try {
		await import('../../src/templates/module-system/builtinModules');
		return { thrown: false, message: '' };
	} catch (error) {
		return { thrown: true, message: error instanceof Error ? error.message : String(error) };
	} finally {
		vi.doUnmock('../../src/templates/module-system/emailModule');
		vi.resetModules();
	}
}

test('Throws moduleDefinitionSchema parse error on invalid entry', async () => {
	const outcome = await evaluateWithInvalidEmailEntry();
	expect(outcome.thrown).toBe(true);
	expect(outcome.message.length).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'template.module-system-builtin-modules',
			symbol: 'builtinModules',
			state: 'throws-moduledefinitionschema-parse-error-on-invalid-entry',
			evidence: 'examples-cases',
			file: 'throws-moduledefinitionschema-parse-error-on-invalid-entry.json'
		},
		[
			{
				name: 'bundled emailModule entry is not an object',
				input: { entry: 'emailModule', value: 'not-a-definition' },
				error: outcome.message
			}
		]
	);
});
