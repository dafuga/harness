import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	addLoopStep,
	completeLoopStep,
	createLoop,
	readLoopStatus,
	renderLoopStatus
} from '../src/workflows/manageLoop';

test('loop workflow creates state and appends trace events', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-unit-'));
	try {
		const now = fixedClock();
		await createLoop({ root, name: 'newsletter-signup', goal: 'Collect emails', now });
		await addLoopStep({
			root,
			loop: 'newsletter-signup',
			step: 'verify',
			title: 'Run checks',
			now
		});
		const status = await completeLoopStep({
			root,
			loop: 'newsletter-signup',
			step: 'verify',
			evidence: 'bun run check passed',
			now
		});

		expect(status.tracePath).toBe('specification/loops/newsletter-signup/trace.ndjson');
		expect(status.state.steps[0]).toMatchObject({
			id: 'verify',
			status: 'complete',
			evidence: 'bun run check passed'
		});
		expect(await readTraceEvents(root)).toEqual(['loop.created', 'step.added', 'step.completed']);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('loop workflow renders human-readable status', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-render-'));
	try {
		await createLoop({ root, name: 'checkout-flow', goal: 'Prove checkout works' });
		await addLoopStep({
			root,
			loop: 'checkout-flow',
			step: 'browser-proof',
			title: 'Verify checkout in browser'
		});

		const output = renderLoopStatus(await readLoopStatus({ root, loop: 'checkout-flow' }));

		expect(output).toContain('Loop: checkout-flow');
		expect(output).toContain('Trace: specification/loops/checkout-flow/trace.ndjson');
		expect(output).toContain('[pending] browser-proof - Verify checkout in browser');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('loop workflow fails cleanly for invalid or conflicting input', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-errors-'));
	try {
		await expect(createLoop({ root, name: 'BadName', goal: 'x' })).rejects.toThrow(
			'Loop name must use lowercase kebab-case'
		);
		await createLoop({ root, name: 'support-chat', goal: 'Ship chat' });
		await expect(createLoop({ root, name: 'support-chat', goal: 'Again' })).rejects.toThrow(
			'Loop already exists'
		);
		await addLoopStep({ root, loop: 'support-chat', step: 'spec', title: 'Write spec' });
		await expect(
			addLoopStep({ root, loop: 'support-chat', step: 'spec', title: 'Again' })
		).rejects.toThrow('already exists');
		await expect(
			completeLoopStep({ root, loop: 'support-chat', step: 'missing', evidence: 'Nope' })
		).rejects.toThrow('does not exist');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

function fixedClock(): () => string {
	const stamps = [
		'2026-01-01T00:00:00.000Z',
		'2026-01-01T00:00:01.000Z',
		'2026-01-01T00:00:02.000Z'
	];
	return () => stamps.shift() ?? '2026-01-01T00:00:03.000Z';
}

async function readTraceEvents(root: string): Promise<string[]> {
	const trace = await readFile(
		join(root, 'specification/loops/newsletter-signup/trace.ndjson'),
		'utf8'
	);
	return trace
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line).event as string);
}
