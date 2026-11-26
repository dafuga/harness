import { statSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { TrackerHealthService } from '../../../src/services/projects-sessions/TrackerHealthService';
import { healthyHubStatus } from '../../support/trackerHealthFixture';
import { fixture, host, inTemp, noon } from '../../support/trackerHealthHarness';

inTemp('a healthy hub passes every check and writes nothing to the Tracker', async (root) => {
	const { service, writes } = await fixture(root);
	const report = await service.run({ alert: true });
	expect(report.failing).toEqual([]);
	expect(report.ok).toBe(true);
	expect(report.checks.map(({ name }) => name)).toEqual(
		expect.arrayContaining([
			'api',
			'sync_listener',
			'webhook',
			'stray_services',
			'disk',
			'memory',
			'load'
		])
	);
	expect(writes()).toEqual([]);
});

inTemp(
	'a failing check raises one structured ask, repeats daily and closes on recovery',
	async (root) => {
		const status = healthyHubStatus();
		status.webhook.stuck = 3;
		const { api, service, clock, writes } = await fixture(root, status);

		expect((await service.run({ alert: true })).ok).toBe(false);
		expect(writes()).toHaveLength(1);
		expect(writes()[0].path).toBe('/native/v1/items');
		expect(writes()[0].body).toMatchObject({ needs_daniel: true, later: true });
		expect(String(writes()[0].body.question)).toContain('3 event(s) failing');
		expect(writes()[0].body.options).toHaveLength(2);
		expect(writes()[0].headers['x-harness-tracker-node']).toBe('fixture-hub');

		clock.now += 4 * 3600_000;
		await service.run({ alert: true });
		expect(writes()).toHaveLength(1);

		clock.now += 24 * 3600_000;
		await service.run({ alert: true });
		expect(writes().at(-1)?.path).toBe('/native/v1/items/health0001/flag');

		status.webhook.stuck = 0;
		await service.run({ alert: true });
		expect(
			writes()
				.slice(-3)
				.map(({ path }) => path.replace('/native/v1/items/health0001/', ''))
		).toEqual(['note', 'unflag', 'done']);

		status.webhook.stuck = 1;
		await service.run({ alert: true });
		expect(
			writes()
				.slice(-2)
				.map(({ path }) => path)
		).toEqual(['/native/v1/items/health0001/reopen', '/native/v1/items/health0001/flag']);
		expect(api.state.itemStatus).toBe('open');
	}
);

inTemp('an ignored health item is never raised again', async (root) => {
	const status = healthyHubStatus();
	status.webhook.stuck = 1;
	const { api, service, clock, writes } = await fixture(root, status);
	await service.run({ alert: true });
	api.state.itemStatus = 'ignored';
	clock.now += 25 * 3600_000;
	await service.run({ alert: true });
	expect(writes()).toHaveLength(1);
});

inTemp(
	'a backup failure is reported without a second ask beside the backup alert',
	async (root) => {
		const status = { ...healthyHubStatus(), backup: { enabled: true, last_error: 'synthetic' } };
		const { service, writes } = await fixture(root, status);
		expect((await service.run({ alert: true })).failing).toMatchObject([{ name: 'backup' }]);
		expect(writes()).toEqual([]);
	}
);

inTemp(
	'the health ask closes when only the separately asked backup check still fails',
	async (root) => {
		const status = healthyHubStatus();
		status.webhook.stuck = 3;
		const failingBackup = { ...status, backup: { enabled: true, stale: true } };
		const { service, writes } = await fixture(root, failingBackup);
		await service.run({ alert: true });
		status.webhook.stuck = 0;
		expect((await service.run({ alert: true })).failing).toMatchObject([{ name: 'backup' }]);
		expect(
			writes()
				.slice(-3)
				.map(({ path }) => path.replace('/native/v1/items/health0001/', ''))
		).toEqual(['note', 'unflag', 'done']);
		expect(String(writes().at(-1)?.body.note)).toContain('backup alert');
		await service.run({ alert: true });
		expect(writes()).toHaveLength(4);
	}
);

inTemp('a run without --alert records and sends nothing', async (root) => {
	const status = healthyHubStatus();
	status.webhook.stuck = 1;
	const { service, writes } = await fixture(root, status);
	expect((await service.run({ alert: false })).ok).toBe(false);
	expect(writes()).toEqual([]);
	expect(() => statSync(join(root, 'tracker.sqlite.health.json'))).toThrow();
});

inTemp('webhook give-ups count only new failures since the last alert run', async (root) => {
	const status = healthyHubStatus();
	status.webhook.outbox = { failed: 5 };
	const { service } = await fixture(root, status);
	expect((await service.run({ alert: true })).ok).toBe(true);
	status.webhook.outbox = { failed: 7 };
	const report = await service.run({ alert: true });
	expect(report.failing).toEqual([
		expect.objectContaining({
			name: 'webhook',
			detail: expect.stringContaining('2 event(s) given up')
		})
	]);
});

inTemp('backup, spoke link, disk and duplicate-service failures are reported', async (root) => {
	const status = { ...healthyHubStatus(), backup: { enabled: true, stale: true } };
	await fixture(root, status);
	const failing = new TrackerHealthService(join(root, 'tracker.json'), {
		now: () => noon,
		host: {
			...host,
			freeDiskBytes: () => 1e9,
			processes: () => [
				{
					pid: 4242,
					ageMinutes: 500,
					command: `harness tracker serve --config ${join(root, 'tracker.json')} --role hub`
				},
				{
					pid: 999,
					ageMinutes: 90,
					command: `harness tracker serve --config ${join(root, 'tracker.json')} --role hub`
				},
				{
					pid: 998,
					ageMinutes: 90,
					command: 'harness tracker serve --config /another/tracker.json --role hub'
				}
			]
		}
	});
	const report = await failing.run({ alert: false });
	expect(report.failing.map(({ name }) => name).sort()).toEqual([
		'backup',
		'disk',
		'stray_services'
	]);
	expect(report.failing.find(({ name }) => name === 'stray_services')?.detail).toBe(
		'extra Tracker service running: pid 999 (90 min)'
	);
});
