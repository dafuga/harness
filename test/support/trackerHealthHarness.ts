import { realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { afterEach, test } from 'vitest';
import { TrackerHealthService } from '../../src/services/projects-sessions/TrackerHealthService';
import { healthConfig, healthyHubStatus, trackerHealthApi } from './trackerHealthFixture';
import { withTempDir } from './temporary';

export const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) await cleanup();
});

export const noon = Date.parse('2026-01-15T12:00:00Z');
export const night = Date.parse('2026-01-15T23:30:00Z');
export const host = {
	freeDiskBytes: () => 100e9,
	availableMemoryMb: () => 8000,
	load15: () => 1,
	cores: 8,
	processes: () => []
};

export async function fixture(root: string, status: Record<string, unknown> = healthyHubStatus()) {
	const api = await trackerHealthApi(status);
	const sync = createServer().listen(0, '127.0.0.1');
	await once(sync, 'listening');
	const syncPort = (sync.address() as { port: number }).port;
	cleanups.push(api.close, () => sync.close());
	const config = healthConfig(root, { apiPort: api.port, syncPort, role: status.role });
	const clock = { now: noon };
	const posted: { url: string; body: string; authorization: string }[] = [];
	const service = new TrackerHealthService(config, {
		host,
		now: () => clock.now,
		apiRetryMs: 0,
		post: async (url, init) => {
			posted.push({
				url,
				body: String(init.body),
				authorization: new Headers(init.headers).get('authorization') ?? ''
			});
			return new Response('ok');
		}
	});
	const writes = () => api.state.requests.filter(({ method }) => method === 'POST');
	return { api, service, clock, posted, writes };
}

export const inTemp = (name: string, body: (root: string) => Promise<void>) =>
	test(name, () => withTempDir('hth-', (dir) => body(realpathSync(dir))));
