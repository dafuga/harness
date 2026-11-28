import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { judgeAnswer } from '../scripts/needs-you-canary/awaitAnswer';
import type { CanarySurface } from '../scripts/needs-you-canary/canary.types';
import { canaryAsk } from '../scripts/needs-you-canary/canaryAsk';
import { canarySurfaces } from '../scripts/needs-you-canary/runCanary';
import { raise, realTracker, tapThrough, type RealTracker } from './support/needsYouCanaryClients';

let tracker: RealTracker;
beforeEach(() => void (tracker = realTracker()));
afterEach(() => tracker.close());

/** What the canary decides after `app` answers the ask it raised for `surface`. */
async function judged(surface: CanarySurface, app: CanarySurface) {
	const ask = canaryAsk({
		surface,
		release: 'release-item',
		nonce: 'n1x',
		expected: 2,
		byHand: true
	});
	const id = await raise(tracker, ask);
	await tapThrough[app](tracker, id, ask, ask.expected);
	const item = await tracker.read(`/items/${id}`);
	expect(item).toMatchObject({ answer: 'Canary B', answer_option: 2 });
	return { item, outcome: judgeAnswer(item, ask) };
}

describe('needs-you canary reads what each app really writes', () => {
	test.each(canarySurfaces)('passes a %s ask answered through that app', async (surface) => {
		const { outcome } = await judged(surface, surface);
		expect(outcome).toMatchObject({ state: 'passed' });
	});

	const crossed = canarySurfaces.flatMap((surface) =>
		canarySurfaces.filter((app) => app !== surface).map((app) => [surface, app] as const)
	);

	test.each(crossed)('fails a %s ask answered through the %s app', async (surface, app) => {
		const { outcome } = await judged(surface, app);
		expect(outcome).toMatchObject({ state: 'failed' });
	});
});
