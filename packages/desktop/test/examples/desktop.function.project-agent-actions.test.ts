import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import {
	projectAgentActions,
	projectAgentComment
} from '../../src/utils/agents-providers/projectAgentActions';
import type { RunDraft } from '../../src/utils/explorer-ui/composeModes.types';
import type { Fixture, Cases } from './desktop.function.project-agent-actions.test.types';
import { planDraft, fixture, recordCases } from './desktop.function.project-agent-actions.cases';
export { fixture } from './desktop.function.project-agent-actions.cases';

const changeDraft: RunDraft = { ...planDraft, mode: 'change', text: 'Add a reset button' };

/**
 * Starts the action, then finishes its run once it is registered. The wait polls without matchers:
 * a retry that is not yet started must not count as a failed assertion.
 */
async function runToFinish(f: Fixture, draft: RunDraft) {
	const sent = projectAgentActions(f.agent, draft);
	await vi.waitFor(() => {
		if (f.agent.runId !== 'run-1') throw new Error('Run not started yet');
	});
	f.finish();
	return sent;
}

test('Starts a plan as a create intent with design options only when supplied', async () => {
	const f = fixture();
	const settledPlain = await runToFinish(f, planDraft);
	const withOptions = await runToFinish(f, { ...planDraft, designOptions: 2 });
	expect([settledPlain, withOptions]).toEqual([true, true]);
	const [first, second] = f.bridge.startRun.mock.calls.map(
		([request]) => request as Record<string, unknown>
	);
	expect(first).not.toHaveProperty('designOptions');
	expect(second).toMatchObject({ intent: 'create', mode: 'plan', designOptions: 2 });
	recordCases('projectAgentActions', 'starts-a-plan-with-design-options-only-when-supplied', [
		{ name: 'plan without design options', input: planDraft, output: first },
		{ name: 'plan with two design options', input: { designOptions: 2 }, output: second }
	]);
});

test('Sends a change at the current revision with the last twenty messages truncated', async () => {
	const f = fixture({
		deployments: {
			selected: { available: true },
			environment: 'preview',
			load: vi.fn(async () => {})
		}
	});
	f.agent.messages = Array.from({ length: 25 }, (_, index) => ({
		id: `message-${index}`,
		author: index % 2 ? ('agent' as const) : ('user' as const),
		text: index === 24 ? 'x'.repeat(5000) : `message ${index}`
	}));
	await runToFinish(f, changeDraft);
	const request = f.bridge.startRun.mock.calls[0]![0] as {
		intent: string;
		mode: string;
		branch: string;
		commit: string;
		environment?: string;
		conversation: Array<{ author: string; text: string }>;
	};
	expect(request).toMatchObject({
		intent: 'task',
		mode: 'change',
		branch: 'main',
		commit: 'abc123',
		environment: 'preview'
	});
	expect(request.conversation).toHaveLength(20);
	expect(request.conversation.at(-1)?.text).toHaveLength(4000);
	recordCases('projectAgentActions', 'sends-a-change-with-the-last-twenty-messages-truncated', [
		{
			name: 'change over 25 prior messages',
			input: { messages: 25, lastLength: 5000 },
			output: {
				intent: request.intent,
				branch: request.branch,
				commit: request.commit,
				environment: request.environment,
				lengths: request.conversation.map(({ text }) => text.length)
			}
		}
	]);
});

test('Keeps the request and the bridge error when starting the run fails', async () => {
	const f = fixture();
	f.bridge.startRun.mockRejectedValueOnce(new Error('bridge offline'));
	const result = await projectAgentActions(f.agent, planDraft);
	const after = {
		result,
		error: f.agent.error,
		asked: f.agent.asked,
		runId: f.agent.runId,
		starting: f.agent.starting
	};
	expect(after).toEqual({
		result: false,
		error: 'Error: bridge offline',
		asked: planDraft.text,
		runId: '',
		starting: false
	});
	recordCases('projectAgentActions', 'keeps-the-request-when-start-fails', [
		{ name: 'startRun rejects with a bridge error', input: planDraft, output: after }
	]);
});

test('Saves a comment as shared or device-only and refuses without a capability', async () => {
	const cases: Cases = [];
	const withheld = fixture({ capabilities: { agents: true, comments: false, reason: '' } });
	cases.push({
		name: 'comment capability withheld',
		input: { text: 'Looks good' },
		output: {
			result: await projectAgentComment(withheld.agent, 'Looks good'),
			calls: withheld.bridge.addComment.mock.calls.length
		}
	});
	const shared = fixture();
	const sharedResult = await projectAgentComment(shared.agent, 'Looks good');
	cases.push({
		name: 'shared to GitHub',
		input: { text: 'Looks good' },
		output: {
			result: sharedResult,
			status: shared.agent.status,
			messages: shared.agent.messages.length
		}
	});
	const device = fixture();
	device.bridge.addComment.mockResolvedValueOnce({ kind: 'pending' });
	const deviceResult = await projectAgentComment(device.agent, 'Looks good');
	cases.push({
		name: 'saved on this device only',
		input: { text: 'Looks good' },
		output: { result: deviceResult, status: device.agent.status }
	});
	const offline = fixture();
	offline.bridge.addComment.mockRejectedValueOnce(new Error('offline'));
	const offlineResult = await projectAgentComment(offline.agent, 'Looks good');
	cases.push({
		name: 'bridge save rejects',
		input: { text: 'Looks good' },
		output: { result: offlineResult, error: offline.agent.error }
	});
	expect(cases.map(({ output }) => (output as { result: unknown }).result)).toEqual([
		false,
		true,
		true,
		false
	]);
	recordCases('projectAgentComment', 'saves-a-comment-as-shared-or-device-only', cases);
});
