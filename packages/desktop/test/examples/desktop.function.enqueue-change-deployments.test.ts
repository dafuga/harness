import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { enqueueChangeDeployments } from '../../src/utils/projects-sessions/enqueueChangeDeployments';

type Runtime = Parameters<typeof enqueueChangeDeployments>[2];
type Input = Parameters<typeof enqueueChangeDeployments>[1];

const root = '/workspace/project';
const commit = '9f4c2a1d7b6e8f0a3c5d9e2b1a6f4c8d0e7b3a5c';
const unreachable = () => {
	throw new Error('Runtime must not be used before environment mapping.');
};
const runtime = {
	plugin: {},
	activities: { ensureCapacity: unreachable, schedule: unreachable, wait: unreachable }
} as unknown as Runtime;

test('rejects an unknown environment before any review', async () => {
	const input = { environment: 'qa', commit, projectId: null } as unknown as Input;
	let thrown: unknown;
	try {
		await enqueueChangeDeployments(root, input, runtime);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'Unknown deployment environment.' });
	if (!(thrown instanceof Error)) throw new Error('Expected an unknown environment error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.enqueue-change-deployments',
			symbol: 'enqueueChangeDeployments',
			state: 'rejects-an-unknown-environment-before-any-review',
			evidence: 'examples-cases',
			file: 'rejects-an-unknown-environment-before-any-review.json'
		},
		[
			{
				name: 'reject an unknown deployment environment without scheduling',
				input: { root, environment: 'qa', commit, projectId: null },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
