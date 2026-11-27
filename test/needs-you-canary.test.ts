import { describe, expect, test } from 'vitest';
import { runCanary } from '../scripts/needs-you-canary/runCanary';
import { isTrackerCosMessage } from '../src/utils/projects-sessions/isTrackerPing';
import { canaryHub, canaryOptions, canaryTracker } from './support/needsYouCanaryWorld';
import type { CanaryWorld } from './support/needsYouCanaryWorld.types';

const everyHand = new Set(['mac', 'iphone'] as const);

/** Daniel taps the option each ask names. */
function obedient(world: CanaryWorld) {
	return (question: string) => {
		const named = /answer "(Canary [A-C])"/.exec(question)?.[1];
		const marker = /\[canary-[a-z0-9-]+\]/.exec(question)?.[0];
		if (named && marker && !question.includes('on Hub web')) world.tap(marker, named);
	};
}

function setup() {
	const world = canaryTracker();
	const release = world.add('PROD DEPLOY sample release');
	return { world, release, item: () => world.rows.get(release)! };
}

const states = (report: Awaited<ReturnType<typeof runCanary>>) =>
	Object.fromEntries(report.results.map((result) => [result.surface, result.state]));

describe('needs-you release canary', () => {
	test('passes only when all three surfaces read back as answered by Daniel', async () => {
		const { world, release, item } = setup();
		const hub = canaryHub(world);
		const report = await runCanary(
			canaryOptions(world, { release, taps: everyHand, web: async () => hub.web }, obedient(world))
		);
		expect(states(report)).toEqual({ web: 'passed', mac: 'passed', iphone: 'passed' });
		expect(report.passed).toBe(true);
		expect(hub.state.closed).toBe(true);
		expect(world.asked()).toHaveLength(3);
		for (const ask of world.asked()) {
			expect(ask).toMatchObject({ status: 'done', answer_option: '2' });
		}
		expect(world.asked().map((ask) => ask.answered_by)).toEqual([
			'Daniel via Hub',
			'daniel',
			'Daniel'
		]);
		expect(item().notes.join('\n')).toContain('needs-you canary PASSED');
		expect(item().status).not.toBe('blocked');
		expect(item().needs_daniel).toBeFalsy();
	});

	test('keeps a signed-out release blocked with a structured ask and raises no web ask', async () => {
		const { world, release, item } = setup();
		const report = await runCanary(
			canaryOptions(world, {
				release,
				web: async () => canaryHub(world, { signedIn: false }).web
			})
		);
		expect(report.passed).toBe(false);
		expect(states(report)).toEqual({ web: 'not-seen', mac: 'not-seen', iphone: 'not-seen' });
		expect(world.asked()).toHaveLength(0);
		expect(item()).toMatchObject({ status: 'blocked', needs_daniel: 1 });
		expect(String(item().blocked_reason)).toMatch(/^needs-you canary:/);
		expect(String(item().question)).toContain('no signed-in Hub session');
		expect(isTrackerCosMessage(String(item().question))).toBe(false);
		expect(JSON.parse(String(item().options))).toHaveLength(3);
	});
});

describe('needs-you release canary failures', () => {
	test.each([
		['rows without option buttons', { rowButtons: false }, 'no option buttons'],
		['a tap that never reaches the Tracker', { delivers: false }, 'did not record an answer']
	])('fails Hub web with %s', async (_name, behaviour, reason) => {
		const { world, release, item } = setup();
		const report = await runCanary(
			canaryOptions(
				world,
				{ release, taps: everyHand, web: async () => canaryHub(world, behaviour).web },
				obedient(world)
			)
		);
		expect(report.passed).toBe(false);
		expect(report.results[0]).toMatchObject({ surface: 'web', state: 'failed' });
		expect(report.results[0]?.detail).toContain(reason);
		expect(item()).toMatchObject({ status: 'blocked', needs_daniel: 1 });
		for (const ask of world.asked()) expect(ask).toMatchObject({ status: 'done' });
		expect(world.asked().filter((ask) => ask.needs_daniel && !ask.resolved)).toEqual([]);
	});

	test('fails a surface answered with another option or by another actor', async () => {
		const { world, release } = setup();
		const report = await runCanary(
			canaryOptions(world, { release, taps: everyHand }, (question) => {
				const marker = /\[canary-[a-z0-9-]+\]/.exec(question)![0];
				if (question.includes('Mac app')) world.tap(marker, 'Canary A');
				if (question.includes('iPhone')) world.tap(marker, 'Canary B', 'some-session');
			})
		);
		expect(states(report)).toEqual({ web: 'passed', mac: 'failed', iphone: 'failed' });
		expect(report.passed).toBe(false);
	});
});

describe('needs-you release canary holds and cleanup', () => {
	test('a later pass removes only the canary block and flag', async () => {
		const { world, release, item } = setup();
		await runCanary(canaryOptions(world, { release }));
		expect(item().status).toBe('blocked');
		const report = await runCanary(
			canaryOptions(world, { release, taps: everyHand }, obedient(world))
		);
		expect(report.passed).toBe(true);
		expect(item().status).toBe('in_progress');
		expect(item().needs_daniel).toBeFalsy();

		await world.tracker(['block', release, 'waiting on another release', '--json']);
		await runCanary(canaryOptions(world, { release, taps: everyHand }, obedient(world)));
		expect(item()).toMatchObject({
			status: 'blocked',
			blocked_reason: 'waiting on another release'
		});
	});

	test('adds test items that never launch and are labelled as tests', async () => {
		const { world, release } = setup();
		await runCanary(canaryOptions(world, { release, taps: everyHand }, obedient(world)));
		const adds = world.commands.filter((args) => args[0] === 'add');
		expect(adds).toHaveLength(3);
		for (const args of adds) expect(args).toContain('--later');
		for (const ask of world.asked()) {
			expect(String(ask.title)).toContain('TEST ONLY');
			expect(isTrackerCosMessage(String(ask.question))).toBe(false);
		}
	});

	test('an unreachable browser is not seen, not a crash', async () => {
		const { world, release, item } = setup();
		const report = await runCanary(
			canaryOptions(world, {
				release,
				web: async () => {
					throw new Error('connect refused');
				}
			})
		);
		expect(report.results[0]).toMatchObject({ surface: 'web', state: 'not-seen' });
		expect(item().status).toBe('blocked');
	});
});
