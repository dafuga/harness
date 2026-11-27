import { beforeAll, describe, expect, test } from 'vitest';
import type { CanaryOptions } from '../scripts/needs-you-canary/canary.types';
import { runCanary } from '../scripts/needs-you-canary/runCanary';
import { realOutageError } from './support/needsYouCanaryOutage';
import { canaryOptions, canaryTracker } from './support/needsYouCanaryWorld';
import type { CanaryWorld } from './support/needsYouCanaryWorld.types';

let outage: Error;
beforeAll(async () => void (outage = await realOutageError()), 30_000);

/** Daniel taps the option each ask names, on every surface. */
function obedient(world: CanaryWorld) {
	return (question: string) => {
		const named = /answer "(Canary [A-C])"/.exec(question)?.[1];
		const marker = /\[canary-[a-z0-9-]+\]/.exec(question)?.[0];
		if (named && marker) world.tap(marker, named);
	};
}

/** The whole run by hand, as released, with `down` deciding which calls get no reply. */
function setup(down: (args: string[], now: number) => boolean) {
	const world = canaryTracker();
	const release = world.add('PROD DEPLOY sample release');
	const calls: string[][] = [];
	const options: CanaryOptions = canaryOptions(
		world,
		{ release, taps: new Set(['web', 'mac', 'iphone'] as const) },
		obedient(world)
	);
	const started = options.clock.now();
	options.tracker = async (args) => {
		calls.push(args);
		if (down(args, options.clock.now() - started)) throw outage;
		return world.tracker(args);
	};
	const elapsed = () => options.clock.now() - started;
	return { world, options, calls, elapsed, item: () => world.rows.get(release)! };
}

function expectCleanPass(run: ReturnType<typeof setup>, passed: boolean) {
	expect(passed).toBe(true);
	expect(run.world.asked()).toHaveLength(3);
	for (const ask of run.world.asked()) expect(ask).toMatchObject({ status: 'done' });
	expect(run.item().notes.join('\n')).toContain('needs-you canary PASSED');
	expect(run.item().status).not.toBe('blocked');
}

describe('needs-you canary across a Tracker restart', () => {
	test('the outage under test is the message the real CLI prints', () => {
		expect(outage.message).toContain('tracker: native service unavailable');
	});

	test('keeps waiting for the tap when the tracker restarts during the wait', async () => {
		let seen = 0;
		let from: number | undefined;
		const run = setup((args, now) => {
			if (args[0] !== 'show' || !args[1]?.startsWith('item2')) return false;
			if (++seen === 1) from = now;
			return now - from! < 45_000;
		});
		const report = await runCanary(run.options);
		expectCleanPass(run, report.passed);
	});

	test('loses no step when each kind of command first meets a restart', async () => {
		const met = new Set<string>();
		const run = setup((args) => {
			if (met.has(args[0])) return false;
			met.add(args[0]);
			return true;
		});
		const report = await runCanary(run.options);
		expectCleanPass(run, report.passed);
		expect([...met]).toEqual(expect.arrayContaining(['show', 'add', 'flag', 'done', 'note']));
	});

	test('records the hold when the tracker restarts as the result is written', async () => {
		let refused = 0;
		const run = setup((args) => args[0] === 'note' && ++refused <= 5);
		run.options.taps = new Set();
		const report = await runCanary(run.options);
		expect(report.passed).toBe(false);
		expect(run.item().notes.join('\n')).toContain('needs-you canary NOT PASSED');
		expect(run.item().status).toBe('blocked');
	});

	test('gives up in bounded time when the tracker stays down', async () => {
		const run = setup(() => true);
		await expect(runCanary(run.options)).rejects.toThrow('native service unavailable');
		expect(run.elapsed()).toBeLessThanOrEqual(15 * 60_000);
	});

	test('does not repeat a command the tracker answered with a refusal', async () => {
		const run = setup(() => false);
		run.options.release = 'missing';
		await expect(runCanary(run.options)).rejects.toThrow('no such item');
		expect(run.calls).toEqual([['show', 'missing']]);
	});
});
