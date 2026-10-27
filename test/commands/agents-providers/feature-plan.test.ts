import { expect, test } from 'vitest';
import { commandFixture, assertApprovedSubmission } from './feature-plan-submit.test.fixtures';
import { FeaturePlanCommand } from '../../../src/commands/agents-providers/FeaturePlanCommand';

test('FeaturePlanCommand.run from default initialization returns the file name', () => {
	// => 'feature-plan'
	expect(new FeaturePlanCommand().run()).toBe('feature-plan');
});

async function assertJsonCommands() {
	const f = commandFixture();
	expect(f.task.commands.map((command) => command.name())).toEqual(['plan']);
	expect(f.task.commands[0].commands.map((command) => command.name()).sort()).toEqual([
		'approve',
		'draft',
		'image',
		'select',
		'show',
		'start'
	]);
	const start = f.task.commands[0].commands.find((command) => command.name() === 'start');
	expect(start?.options.map((option) => option.long)).toEqual(
		expect.arrayContaining(['--worker', '--parallelism'])
	);
	const image = f.task.commands[0].commands.find((command) => command.name() === 'image');
	expect(image?.options.map((option) => option.long)).toEqual([
		'--page',
		'--option',
		'--digest',
		'--output'
	]);
	await f.run(['draft', '--input', 'synthetic.json', '--json']);
	expect(f.readInput).toHaveBeenCalledExactlyOnceWith('synthetic.json');
	expect(f.service.draft).toHaveBeenCalledExactlyOnceWith({
		feature: 'checkout',
		goal: 'Draft input'
	});
	await f.run(['show', 'checkout', '--json']);
	expect(f.repository.read).toHaveBeenCalledWith('checkout');
	await assertJsonSelectionAndApproval(f);
	expect(f.output.mock.calls.map(([text]) => JSON.parse(text))).toEqual([
		f.plan,
		f.plan,
		f.plan,
		f.plan
	]);
}

async function assertJsonSelectionAndApproval(f: ReturnType<typeof commandFixture>) {
	await f.run([
		'select',
		'checkout',
		'--page',
		'page.orders',
		'--option',
		'option-two',
		'--digest',
		f.plan.digest,
		'--json'
	]);
	expect(f.service.select).toHaveBeenCalledExactlyOnceWith({
		feature: 'checkout',
		page: 'page.orders',
		option: 'option-two',
		expectedDigest: f.plan.digest
	});
	await f.run([
		'approve',
		'checkout',
		'--digest',
		f.plan.digest,
		'--reviewer',
		'Human Reviewer',
		'--json'
	]);
	expect(f.service.approve).toHaveBeenCalledExactlyOnceWith({
		feature: 'checkout',
		expectedDigest: f.plan.digest,
		reviewer: 'Human Reviewer'
	});
}

async function assertHumanDisplay() {
	const f = commandFixture();
	const older = { ...f.plan, revision: 1, goal: 'Superseded goal' };
	f.repository.read.mockResolvedValue({ commit: 'a'.repeat(40), plans: [older, f.plan] });
	const before = structuredClone(f.plan);
	await f.run(['show', 'checkout']);
	const text = f.output.mock.calls.map(([line]) => line).join('\n');
	for (const value of [
		'checkout',
		'page.orders',
		'option-one',
		'option-two',
		'service.orders',
		'Render a verified order.',
		'orderId',
		'string',
		'receipt',
		'OrderReceipt',
		'missing-order'
	]) {
		expect(text).toContain(value);
	}
	expect(text.toLowerCase()).toContain('preferred');
	expect(text.toLowerCase()).toMatch(/selected|chosen/);
	expect(text).not.toContain('Superseded goal');
	expect(f.plan).toEqual(before);
	expect(f.service.draft).not.toHaveBeenCalled();
	expect(f.service.select).not.toHaveBeenCalled();
	expect(f.service.approve).not.toHaveBeenCalled();
}

async function assertFailures() {
	for (const operation of ['draft', 'select', 'approve', 'show', 'bad-json'] as const) {
		const f = commandFixture();
		const before = structuredClone(f.plan);
		const failure =
			operation === 'bad-json' ? new SyntaxError('bad JSON') : new Error(`${operation} rejected`);
		let args: string[];
		if (operation === 'draft' || operation === 'bad-json') {
			args = ['draft', '--input', 'broken.json', '--json'];
			if (operation === 'bad-json') f.readInput.mockRejectedValue(failure);
			else f.service.draft.mockRejectedValue(failure);
		} else if (operation === 'select') {
			args = [
				'select',
				'checkout',
				'--page',
				'page.orders',
				'--option',
				'unknown',
				'--digest',
				f.plan.digest,
				'--json'
			];
			f.service.select.mockRejectedValue(failure);
		} else if (operation === 'approve') {
			args = ['approve', 'checkout', '--digest', f.plan.digest, '--reviewer', 'Reviewer', '--json'];
			f.service.approve.mockRejectedValue(failure);
		} else {
			args = ['show', 'checkout', '--json'];
			f.repository.read.mockRejectedValue(failure);
		}
		await expect(f.run(args)).rejects.toBe(failure);
		expect(f.output).not.toHaveBeenCalled();
		expect(f.server.submitApproved).not.toHaveBeenCalled();
		expect(f.plan).toEqual(before);
		if (operation === 'bad-json') expect(f.service.draft).not.toHaveBeenCalled();
	}
	const missing = commandFixture();
	missing.repository.read.mockResolvedValue({ commit: undefined, plans: [] });
	await expect(missing.run(['show', 'missing', '--json'])).rejects.toThrow();
	expect(missing.output).not.toHaveBeenCalled();
}

async function assertFailedDispatchExit() {
	const f = commandFixture();
	const result = {
		submission: { created: ['checkout.task'], reused: [], commit: 'f'.repeat(40) },
		results: [{ status: 'idle' }, { status: 'failed', task: 'checkout.task' }]
	};
	f.server.runApproved.mockResolvedValue(result);
	const previous = process.exitCode;
	process.exitCode = 0;
	try {
		await f.run([
			'start',
			'checkout',
			'--digest',
			f.plan.digest,
			'--worker',
			'worker-one',
			'--json'
		]);
		expect(f.output.mock.calls.map(([text]) => JSON.parse(text))).toEqual([result]);
		expect(process.exitCode, 'failed worker outcome must fail the CLI').toBe(1);
	} finally {
		process.exitCode = previous;
	}
}

test('FeaturePlanCommand.register exposes draft, show, select and approve with safe output', async () => {
	await assertJsonCommands();
	await assertHumanDisplay();
	await assertFailures();
	await assertApprovedSubmission();
	await assertFailedDispatchExit();
});
