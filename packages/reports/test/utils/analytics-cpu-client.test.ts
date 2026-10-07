import { expect, test, vi } from 'vitest';
import { analyticsCpuClient } from '../../src/utils/analyticsCpuClient';
test('refresh failure clears stale CPU values and disposal aborts polling', async () => {
	vi.useFakeTimers();
	vi.stubGlobal('document', { visibilityState: 'visible' });
	const fetcher = vi
		.fn()
		.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ status: 'available', machinePercent: 10 })
		})
		.mockResolvedValue({ ok: false });
	vi.stubGlobal('fetch', fetcher);
	const update = vi.fn();
	const client = analyticsCpuClient(update);
	await vi.advanceTimersByTimeAsync(0);
	expect(update).toHaveBeenLastCalledWith({ status: 'available', machinePercent: 10 });
	await client.refresh();
	expect(update).toHaveBeenLastCalledWith(null);
	client.stop();
	await vi.advanceTimersByTimeAsync(10000);
	expect(fetcher).toHaveBeenCalledTimes(2);
	expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
