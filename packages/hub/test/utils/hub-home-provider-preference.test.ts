import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { parseHomePayload } from '../../src/routes/api/hub-home/homePayload';

const now = Date.parse('2026-11-28T12:00:00Z');
const preference = { provider: 'claude' as const, until: '2026-11-29T12:00:00.000Z' };

function tracker(reply: () => Response) {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input);
		if (url.endsWith('/autolaunch/preference')) return reply();
		return Response.json([]);
	});
}

test('Home carries the active provider preference through to the Hub', async () => {
	const fetcher = tracker(() =>
		Response.json({ provider_preference: { ...preference, set_at: '2026-11-28T11:00:00Z' } })
	);
	const sources = await readTrackerSources(fetcher, true);
	const snapshot = buildHomeSnapshot(sources, noProviders, now);
	expect(snapshot.providerPreference).toEqual(preference);
	expect(parseHomePayload(JSON.parse(JSON.stringify(snapshot))).providerPreference).toEqual(
		preference
	);
});

test('Home omits the preference when it is off or the Tracker is older', async () => {
	for (const reply of [
		() => Response.json({ provider_preference: null }),
		() => new Response('not found', { status: 404 })
	]) {
		const sources = await readTrackerSources(tracker(reply), true);
		expect(buildHomeSnapshot(sources, noProviders, now)).not.toHaveProperty('providerPreference');
	}
});
