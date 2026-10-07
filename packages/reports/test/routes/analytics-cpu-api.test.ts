import { expect, test, vi } from 'vitest';
const snapshot = vi.hoisted(() => vi.fn());
vi.mock('../../../../src/services/CpuUsageService', () => ({
	CpuUsageService: class {
		snapshot = snapshot;
	}
}));
import { GET } from '../../src/routes/api/analytics-cpu/+server';
test('CPU telemetry is local-only and never cached', async () => {
	const blocked = await GET({ url: new URL('https://reports.example/api/analytics-cpu') });
	expect(blocked.status).toBe(403);
	snapshot.mockResolvedValue({ status: 'available', machinePercent: 10 });
	const response = await GET({ url: new URL('http://127.0.0.1/api/analytics-cpu') });
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toMatchObject({ machinePercent: 10 });
	snapshot.mockResolvedValue({ status: 'unavailable', machinePercent: null });
	expect((await GET({ url: new URL('http://localhost/api/analytics-cpu') })).status).toBe(503);
});
