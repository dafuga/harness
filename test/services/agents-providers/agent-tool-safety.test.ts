import { expect, test } from 'vitest';
import type { AgentToolSafetyService } from '../../../src/lib/runtime';
import {
	agentId,
	fixture,
	fixtureDocument,
	proposal,
	resource,
	second
} from './agent-tool-safety.fixtures';

async function reviewId(safety: AgentToolSafetyService, call: string): Promise<string> {
	const decision = await safety.submit(agentId, call);
	if (decision.status !== 'held') throw new Error('Expected host review.');
	return decision.review.id;
}

test('dispatches an uncensored model’s tool proposals only within the owner grants', async () => {
	const { safety, execute, events, policy } = fixture();
	policy.declaredTools = policy.declaredTools.filter((tool) => tool !== 'lookup');
	const output = [
		proposal('constructor'),
		proposal('lookup'),
		proposal('read_file', 'other-owner'),
		JSON.stringify({ tool: 'pay', input: {}, approved: true }),
		...['pay', 'transfer', 'send', 'delete', 'publish', 'deploy', 'shell', 'sign', 'share'].map(
			(tool) => proposal(tool)
		)
	];
	const decisions = await Promise.all(output.map((raw) => safety.submit(agentId, raw)));
	expect(decisions.map(({ status }) => status)).toEqual([
		'denied',
		'denied',
		'denied',
		'denied',
		...Array.from({ length: 9 }, () => 'held')
	]);
	expect(execute).not.toHaveBeenCalled();
	expect(await safety.submit(agentId, proposal('read_file'))).toEqual({
		status: 'executed',
		output: 'effect result'
	});
	expect(events.filter((event) => event.state === 'requested')).toHaveLength(output.length + 1);
	expect(events.filter((event) => event.state === 'completed')).toHaveLength(1);
	expect(JSON.stringify(events)).not.toContain(fixtureDocument);
	expect(JSON.stringify(events)).not.toContain('other-owner');
});

test('binds owner approval to exact arguments, revision and expiry and consumes it once', async () => {
	const { safety, execute, policy, advance, options } = fixture();
	const sender = options.tools.send;
	let draft = fixtureDocument;
	options.tools = {
		...options.tools,
		send: {
			action: sender.action,
			prepare(input) {
				const prepared = sender.prepare(input);
				return prepared && { ...prepared, content: draft };
			}
		}
	};
	const call = proposal('send');
	const id = await reviewId(safety, call);
	expect(
		await safety.approve(agentId, id, proposal('send', resource, 'different content'))
	).toEqual({ status: 'denied', reason: 'approval-invalid' });
	draft = 'updated draft at the same resource';
	expect(await safety.approve(agentId, id, call)).toEqual({
		status: 'denied',
		reason: 'approval-invalid'
	});
	expect(execute).not.toHaveBeenCalled();
	draft = fixtureDocument;
	policy.revision = '2';
	expect(await safety.approve(agentId, id, call)).toEqual({
		status: 'denied',
		reason: 'approval-invalid'
	});
	const expired = await reviewId(safety, call);
	advance(5 * 60 * second);
	expect(await safety.approve(agentId, expired, call)).toEqual({
		status: 'denied',
		reason: 'approval-invalid'
	});
	const valid = await reviewId(safety, call);
	const results = await Promise.all([
		safety.approve(agentId, valid, call),
		safety.approve(agentId, valid, call)
	]);
	expect(results.map((result) => result.status).sort()).toEqual(['denied', 'executed']);
	expect(execute).toHaveBeenCalledTimes(1);
});

test('reserves lifetime spend and rolling capacity before concurrent effects', async () => {
	const { safety, policy, execute, advance } = fixture();
	const call = proposal('pay');
	const [id1, id2] = await Promise.all([reviewId(safety, call), reviewId(safety, call)]);
	const results = await Promise.all([
		safety.approve(agentId, id1, call),
		safety.approve(agentId, id2, call)
	]);
	expect(results.map((result) => result.status).sort()).toEqual(['denied', 'executed']);
	expect(results).toContainEqual({ status: 'denied', reason: 'spend-limit' });
	policy.maxCallsPerMinute = 1;
	expect(await safety.submit(agentId, proposal('read_file'))).toEqual({
		status: 'denied',
		reason: 'rate-limit'
	});
	advance(60 * second);
	expect(await safety.submit(agentId, proposal('read_file'))).toMatchObject({ status: 'executed' });
	expect(execute).toHaveBeenCalledTimes(2);
});

test('reruns content screening after review and fails closed on missing or failing dependencies', async () => {
	const { safety, options, checkContent, closeJournal, events, execute } = fixture();
	const call = proposal('publish');
	const id = await reviewId(safety, call);
	checkContent.mockReturnValueOnce(false);
	expect(await safety.approve(agentId, id, call)).toEqual({
		status: 'denied',
		reason: 'content-rejected'
	});
	checkContent.mockRejectedValueOnce(new Error('Classifier contains private input'));
	expect(await safety.submit(agentId, call)).toEqual({
		status: 'denied',
		reason: 'content-unavailable'
	});
	options.checkContent = undefined;
	expect(await safety.submit(agentId, call)).toEqual({
		status: 'denied',
		reason: 'content-unavailable'
	});
	closeJournal();
	expect(await safety.submit(agentId, proposal('read_file'))).toEqual({
		status: 'denied',
		reason: 'journal-unavailable'
	});
	expect(execute).not.toHaveBeenCalled();
	expect(JSON.stringify(events)).not.toContain('private input');
	expect(checkContent).toHaveBeenCalledWith(fixtureDocument, {
		action: 'publish',
		specialty: 'researcher'
	});
});

test('revalidates current policy after asynchronous content and adapter checks', async () => {
	const { safety, checkContent, execute, revoke, events } = fixture();
	checkContent.mockImplementationOnce(async () => {
		revoke();
		return true;
	});
	expect(await safety.submit(agentId, proposal('publish'))).toEqual({
		status: 'denied',
		reason: 'not-authorized'
	});
	expect(execute).not.toHaveBeenCalled();

	const secondHost = fixture();
	secondHost.execute.mockImplementationOnce(async (assertCurrent) => {
		secondHost.revoke();
		assertCurrent();
		return 'unexpected effect';
	});
	const result = await secondHost.safety.submit(agentId, proposal('read_file'));
	expect(result).toEqual({ status: 'failed' });
	expect(secondHost.events.map((event) => event.state)).toEqual([
		'requested',
		'reserved',
		'failed'
	]);
	expect(events.map((event) => event.state)).toEqual(['requested', 'denied']);
});
