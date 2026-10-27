import { expect, vi } from 'vitest';
import { Command } from 'commander';
import { FeaturePlanCommand } from '../../../src/commands/agents-providers/FeaturePlanCommand';

function storedPlan() {
	const wantedContract = {
		responsibility: 'Render a verified order.',
		inputs: [{ name: 'orderId', type: 'string' }],
		outputs: [{ name: 'receipt', type: 'OrderReceipt' }],
		errors: [{ name: 'missing-order', type: 'Error' }]
	};
	return {
		feature: 'checkout',
		goal: 'Review checkout.',
		tldr: 'Select an order design.',
		sourceCommit: 'a'.repeat(40),
		revision: 2,
		digest: 'b'.repeat(64),
		tasks: [],
		pages: [
			{
				module: 'page.orders',
				selected: 'option-two',
				options: [
					{
						id: 'option-one',
						version: 'v1',
						commit: 'c'.repeat(40),
						path: 'design/one.png',
						sha256: 'd'.repeat(64),
						preferred: true
					},
					{
						id: 'option-two',
						version: 'v1',
						commit: 'c'.repeat(40),
						path: 'design/two.png',
						sha256: 'e'.repeat(64),
						preferred: false
					}
				]
			}
		],
		changes: [
			{ unit: 'service.orders', kind: 'reuse' as const, assignedFiles: ['src/orders.ts'] },
			{
				unit: 'page.orders',
				parent: 'service.orders',
				kind: 'modify' as const,
				assignedFiles: ['src/page.ts'],
				wantedContract
			}
		]
	};
}

export function commandFixture() {
	const plan = storedPlan();
	const output = vi.fn();
	const service = {
		draft: vi.fn().mockResolvedValue(plan),
		select: vi.fn().mockResolvedValue(plan),
		approve: vi.fn().mockResolvedValue(plan)
	};
	const repository = { read: vi.fn().mockResolvedValue({ commit: 'a'.repeat(40), plans: [plan] }) };
	const readInput = vi.fn().mockResolvedValue({ feature: 'checkout', goal: 'Draft input' });
	const server = {
		submitApproved: vi
			.fn()
			.mockResolvedValue({ created: ['checkout.task'], reused: [], commit: 'f'.repeat(40) }),
		runApproved: vi.fn()
	};
	const task = new Command('task').exitOverride();
	const dependencies = { service, repository, output, readInput, server };
	new FeaturePlanCommand(dependencies).register(task);
	const run = (args: string[]) => task.parseAsync(['plan', ...args], { from: 'user' });
	return { plan, output, service, repository, readInput, task, run, server };
}

async function assertApprovalWaitsForSubmission() {
	const f = commandFixture();
	let approve!: () => void;
	f.service.approve.mockImplementation(
		() =>
			new Promise((resolve) => {
				approve = () => resolve(f.plan);
			})
	);
	let complete!: () => void;
	f.server.submitApproved.mockImplementation(
		() =>
			new Promise((resolve) => {
				complete = () =>
					resolve({ created: ['checkout.task'], reused: [], commit: 'f'.repeat(40) });
			})
	);
	const run = f.run([
		'approve',
		'checkout',
		'--digest',
		f.plan.digest,
		'--reviewer',
		'Reviewer',
		'--json'
	]);
	await vi.waitFor(() => expect(f.service.approve).toHaveBeenCalledTimes(1));
	expect(f.server.submitApproved).not.toHaveBeenCalled();
	expect(f.output).not.toHaveBeenCalled();
	approve();
	await vi.waitFor(() => expect(f.server.submitApproved).toHaveBeenCalledTimes(1));
	expect(f.service.approve).toHaveBeenCalledExactlyOnceWith({
		feature: 'checkout',
		expectedDigest: f.plan.digest,
		reviewer: 'Reviewer'
	});
	expect(f.server.submitApproved).toHaveBeenCalledExactlyOnceWith({
		feature: 'checkout',
		expectedDigest: f.plan.digest
	});
	expect(f.service.approve.mock.invocationCallOrder[0]).toBeLessThan(
		f.server.submitApproved.mock.invocationCallOrder[0]
	);
	expect(f.output).not.toHaveBeenCalled();
	complete();
	await run;
	expect(f.output.mock.calls.map(([text]) => JSON.parse(text))).toEqual([f.plan]);
}

async function assertSubmissionFailureAndRetry() {
	const f = commandFixture();
	const failure = new Error('Approved submission rejected');
	f.server.submitApproved.mockRejectedValueOnce(failure);
	await expect(
		f.run(['approve', 'checkout', '--digest', f.plan.digest, '--reviewer', 'Reviewer', '--json'])
	).rejects.toBe(failure);
	expect(f.service.approve).toHaveBeenCalledTimes(1);
	expect(f.output).not.toHaveBeenCalled();
	const submission = { created: [], reused: ['checkout.task'], commit: 'f'.repeat(40) };
	f.server.submitApproved.mockResolvedValue(submission);
	await f.run(['start', 'checkout', '--digest', f.plan.digest, '--json']);
	await f.run(['start', 'checkout', '--digest', f.plan.digest, '--json']);
	expect(f.service.approve).toHaveBeenCalledTimes(1);
	expect(f.server.submitApproved.mock.calls).toEqual(
		Array(3).fill([{ feature: 'checkout', expectedDigest: f.plan.digest }])
	);
	expect(f.output.mock.calls.map(([text]) => JSON.parse(text))).toEqual([submission, submission]);
	f.output.mockClear();
	f.server.submitApproved.mockRejectedValue(failure);
	await expect(f.run(['start', 'checkout', '--digest', f.plan.digest, '--json'])).rejects.toBe(
		failure
	);
	expect(f.output).not.toHaveBeenCalled();
	expect(f.service.approve).toHaveBeenCalledTimes(1);
}

async function assertScopedDispatch() {
	const f = commandFixture();
	const result = {
		submission: { created: ['checkout.task'], reused: [], commit: 'f'.repeat(40) },
		results: [{ status: 'review', task: 'checkout.task' }, { status: 'idle' }]
	};
	f.server.runApproved.mockResolvedValue(result);
	const before = { int: process.listeners('SIGINT'), term: process.listeners('SIGTERM') };
	await f.run([
		'start',
		'checkout',
		'--digest',
		f.plan.digest,
		'--worker',
		'worker-one',
		'--parallelism',
		'2',
		'--json'
	]);
	expect(f.server.runApproved).toHaveBeenCalledExactlyOnceWith(
		{ feature: 'checkout', expectedDigest: f.plan.digest },
		{ worker: 'worker-one', parallelism: 2, signal: expect.any(AbortSignal) }
	);
	expect(f.server.submitApproved).not.toHaveBeenCalled();
	expect(f.service.approve).not.toHaveBeenCalled();
	expect(f.output.mock.calls.map(([text]) => JSON.parse(text))).toEqual([result]);
	expect(process.listeners('SIGINT')).toEqual(before.int);
	expect(process.listeners('SIGTERM')).toEqual(before.term);
	for (const args of [
		['--parallelism', '2'],
		['--worker', 'worker-one', '--parallelism', '0'],
		['--worker', 'worker-one', '--parallelism', '9'],
		['--worker', 'worker-one', '--parallelism', '1.5'],
		['--worker', 'worker-one', '--parallelism', 'invalid']
	]) {
		const invalid = commandFixture();
		await expect(
			invalid.run(['start', 'checkout', '--digest', f.plan.digest, ...args])
		).rejects.toThrow();
		expect(invalid.server.runApproved).not.toHaveBeenCalled();
		expect(invalid.server.submitApproved).not.toHaveBeenCalled();
		expect(invalid.output).not.toHaveBeenCalled();
	}
}

export async function assertApprovedSubmission() {
	await assertApprovalWaitsForSubmission();
	await assertSubmissionFailureAndRetry();
	await assertScopedDispatch();
}
