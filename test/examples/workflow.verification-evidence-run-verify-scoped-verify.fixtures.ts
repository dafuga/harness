import { vi } from 'vitest';
import { ZodError } from 'zod';
import {
	timer,
	verifyEnv
} from '../../src/workflows/verification-evidence/run-verify/scopedVerify';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

export const unitId = 'workflow.verification-evidence-run-verify-scoped-verify';

export const entity = 'reports.component.evidence-grid';

export const scopedTimingsExample = () => {
	const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
	timer(entity)('snapshot started');
	const emitted = write.mock.calls.map(([chunk]) => String(chunk));
	expect(emitted).toHaveLength(1);
	expect(emitted[0]).toMatch(
		/^\[verify reports\.component\.evidence-grid\] snapshot started \+\d+ms\n$/
	);
	write.mockClear();
	timer(undefined)('unscoped step');
	timer('')('empty entity step');
	const suppressed = write.mock.calls.length;
	expect(suppressed).toBe(0);
	recordExampleCases(
		{
			unitId,
			symbol: 'timer',
			state: 'writes-scoped-timings-and-suppresses-unscoped-output',
			evidence: 'examples-cases',
			file: 'writes-scoped-timings-and-suppresses-unscoped-output.json'
		},
		[
			{
				name: 'A truthy entity prefixes its timing message',
				input: { entity, step: 'snapshot started' },
				output: emitted[0]
			},
			{
				name: 'An omitted entity emits no timing message',
				input: { entity: null, step: 'unscoped step' },
				output: { writes: suppressed }
			},
			{
				name: 'An empty entity emits no timing message',
				input: { entity: '', step: 'empty entity step' },
				output: { writes: suppressed }
			}
		]
	);
};

export const scopedPriorityExample = () => {
	const options = { priority: 'agent-test', entity };
	const environment = verifyEnv(options);
	const selected = {
		HARNESS_RESOURCE_PRIORITY: environment.HARNESS_RESOURCE_PRIORITY,
		HARNESS_VERIFY_ENTITY: environment.HARNESS_VERIFY_ENTITY
	};
	let invalid: { name: string; paths: string[] };
	try {
		verifyEnv({ priority: 'emergency' });
		throw new Error('Expected an unsupported resource priority to be rejected.');
	} catch (error) {
		if (!(error instanceof ZodError)) throw error;
		invalid = { name: error.name, paths: error.issues.map((issue) => issue.path.join('.')) };
	}
	expect(selected).toEqual({
		HARNESS_RESOURCE_PRIORITY: 'agent-test',
		HARNESS_VERIFY_ENTITY: entity
	});
	expect(invalid).toEqual({ name: 'ZodError', paths: [''] });
	recordExampleCases(
		{
			unitId,
			symbol: 'verifyEnv',
			state: 'sets-verification-priority-and-entity-options',
			evidence: 'examples-cases',
			file: 'sets-verification-priority-and-entity-options.json'
		},
		[
			{
				name: 'Explicit options select the test priority and entity',
				input: options,
				output: selected
			},
			{
				name: 'An unsupported priority is rejected',
				input: { priority: 'emergency' },
				error: invalid
			}
		]
	);
};
