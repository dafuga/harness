import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { prepareChangeEnvironment, promoteChange } from '../../src/utils/projects-sessions/promoteChange';
import { PromotionError } from '../../src/utils/projects-sessions/promoteChange.types';
import type { PromotionContext } from '../../src/utils/projects-sessions/promoteChange.types';

const context = (signal: AbortSignal, environment?: 'prod'): PromotionContext => ({
	root: '/tmp/example-project',
	id: 'run-example',
	emit: () => undefined,
	signal,
	session: { atBranch: async () => undefined } as unknown as PromotionContext['session'],
	revision: { branch: 'main' } as PromotionContext['revision'],
	request: { environment }
});

test('skips environment checks when no environment is requested', async () => {
	const session = { requireProject: () => ({ root: '/tmp/example-project' }) } as Parameters<
	typeof prepareChangeEnvironment
	>[0];
	const input = { mode: 'change' as const };
	const output = await prepareChangeEnvironment(session, input);

	expect(output).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'desktop.function.promote-change',
			symbol: 'prepareChangeEnvironment',
			state: 'skips-environment-checks-when-no-environment-is-requested',
			evidence: 'examples-cases',
			file: 'skips-environment-checks-when-no-environment-is-requested.json'
		},
		[{ name: 'change without a deployment target', input, output }]
	);
});

test('records changes when no deployment environment is requested', async () => {
	const input = context(new AbortController().signal);
	const output = await promoteChange(input, new Map());

	expect(output).toBe('Code changes recorded. Verification is still required.');
	recordExampleCases(
		{
			unitId: 'desktop.function.promote-change',
			symbol: 'promoteChange',
			state: 'records-changes-when-no-deployment-environment-is-requested',
			evidence: 'examples-cases',
			file: 'records-changes-when-no-deployment-environment-is-requested.json'
		},
		[{ name: 'no environment selected', input: { environment: undefined }, output }]
	);
});

test('rejects a cancelled environment change before verification', async () => {
	const controller = new AbortController();
	controller.abort();
	const input = context(controller.signal, 'prod');
	let thrown: unknown;
	try {
		await promoteChange(input, new Map());
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(PromotionError);
	expect(thrown).toMatchObject({ message: 'Change cancelled before deployment.' });
	if (!(thrown instanceof Error)) throw new Error('Expected a cancellation error.');
	recordExampleCases(
		{
			unitId: 'desktop.function.promote-change',
			symbol: 'promoteChange',
			state: 'rejects-a-cancelled-environment-change-before-verification',
			evidence: 'examples-cases',
			file: 'rejects-a-cancelled-environment-change-before-verification.json'
		},
		[
			{
				name: 'cancelled production request',
				input: { environment: 'prod', aborted: true },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
