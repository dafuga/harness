import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { activityClient } from '../../src/components/projects-sessions/site-activity/activityClient';

test('Refresh reads activity and reports unavailable responses', async () => {
	const listeners = new Set<() => void>();
	vi.stubGlobal('document', {
		visibilityState: 'hidden',
		addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
		removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener)
	});
	vi.stubGlobal('setInterval', () => 1);
	vi.stubGlobal('clearInterval', vi.fn());
	const fetchMock = vi.fn()
		.mockResolvedValueOnce({ ok: true, json: async () => ({ updatedAt: '2026-11-16T10:00:00Z' }) })
		.mockResolvedValueOnce({ ok: false });
	vi.stubGlobal('fetch', fetchMock);
	const readings: unknown[] = [];
	let missed = 0;
	const client = activityClient((shown) => readings.push(shown), () => missed++);
	try {
		expect(fetchMock).not.toHaveBeenCalled();
		await client.refresh();
		await client.refresh();
		expect(readings).toEqual([{ updatedAt: '2026-11-16T10:00:00Z' }]);
		expect(missed).toBe(1);
		expect(fetchMock.mock.calls[0]).toEqual([
			'/api/project-activity',
			{ cache: 'no-store', signal: expect.any(AbortSignal) }
		]);
		client.stop();
		expect(listeners.size).toBe(0);
		recordExampleCases(
			{
				unitId: 'reports.function.activity-client',
				symbol: 'activityClient',
				state: 'refresh-reads-activity-and-reports-unavailable-responses',
				evidence: 'examples-cases',
				file: 'refresh-reads-activity-and-reports-unavailable-responses.json'
			},
			[
				{
					name: 'successful response is delivered to the page',
					input: { path: '/api/project-activity', cache: 'no-store', status: 200 },
					output: { readings, missed: 0 }
				},
				{
					name: 'non-ok response is reported as a missed reading',
					input: { path: '/api/project-activity', cache: 'no-store', status: 503 },
					output: { missed }
				}
			]
		);
	} finally {
		client.stop();
		vi.unstubAllGlobals();
	}
});
