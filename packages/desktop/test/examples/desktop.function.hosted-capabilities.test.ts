import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedCapabilities } from '../../src/utils/networking-security/hostedCapabilities';
import { UnknownHostedProjectAccessError } from '../../src/utils/networking-security/hostedCapabilities.types';
import type { RejectInput } from './desktop.function.hosted-capabilities.test.types';

const ownerId = '3f6d2a8e-5b1c-4e9a-8d7f-0c2b9e4a6d13';
const writerId = 'c0a8e5f1-7b2d-4e6a-b3c9-1d8f5a2e7b04';
const viewerId = '9b1e4c7a-2d3f-4a8b-9c5e-6f7a8b9c0d1e';

function response(id: string, role: string, executionAvailable: boolean) {
	return { id, name: 'Example Project', role, executionAvailable };
}

function access(comments: boolean, agents: boolean, reason: string) {
	return { comments, agents, planning: agents, approval: agents, source: 'github', reason };
}

function thrownBy(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
	}
	throw new Error('Expected the call to throw an Error.');
}

const roleInputs = [
	{ name: 'owner with an executor', value: response(ownerId, 'owner', true), projectId: ownerId },
	{
		name: 'writer without an executor',
		value: response(writerId, 'writer', false),
		projectId: writerId
	},
	{ name: 'commenter', value: response(writerId, 'commenter', false), projectId: writerId },
	{ name: 'viewer', value: response(viewerId, 'viewer', false), projectId: viewerId }
];

const rejectInputs: RejectInput[] = [
	{ name: 'project id differs', value: response(writerId, 'writer', true), projectId: ownerId },
	{ name: 'unknown role', value: response(ownerId, 'admin', true), projectId: ownerId },
	{ name: 'null response', value: null, projectId: ownerId }
];

function rejection(input: RejectInput) {
	const error = thrownBy(() => hostedCapabilities(input.value, input.projectId));
	return {
		error,
		record: {
			name: input.name,
			input: { value: input.value, projectId: input.projectId },
			error: { name: error.name, message: error.message }
		}
	};
}

test('Maps each hosted role to its capabilities', () => {
	const outputs = roleInputs.map((input) => hostedCapabilities(input.value, input.projectId));
	const [owner, writer, commenter, viewer] = outputs;

	expect(owner).toEqual(access(true, true, 'Write access: comments and AI requests.'));
	expect(writer).toEqual(
		access(true, false, 'Write access. Connect a project executor to run AI.')
	);
	expect(commenter).toEqual(access(true, false, 'Comment access: read and leave comments.'));
	expect(viewer).toEqual(access(false, false, 'Read access: browse only.'));

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-capabilities',
			symbol: 'hostedCapabilities',
			state: 'maps-each-hosted-role-to-its-capabilities',
			evidence: 'examples-cases',
			file: 'maps-each-hosted-role-to-its-capabilities.json'
		},
		roleInputs.map((input, index) => ({
			name: input.name,
			input: { value: input.value, projectId: input.projectId },
			output: outputs[index]
		}))
	);
});

test('Rejects a mismatched or unknown hosted response', () => {
	const rejected = rejectInputs.map(rejection);
	const errors = rejected.map((entry) => entry.error);
	const [mismatch] = errors;

	expect(mismatch).toBeInstanceOf(UnknownHostedProjectAccessError);
	expect(errors.map((error) => error.message)).toEqual([
		'Unknown hosted project access.',
		'Unknown hosted project access.',
		'Invalid hosted response.'
	]);

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-capabilities',
			symbol: 'hostedCapabilities',
			state: 'rejects-a-mismatched-or-unknown-hosted-response',
			evidence: 'examples-cases',
			file: 'rejects-a-mismatched-or-unknown-hosted-response.json'
		},
		rejected.map((entry) => entry.record)
	);
});
