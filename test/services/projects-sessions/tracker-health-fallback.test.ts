import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { rotateTrackerLog } from '../../../src/services/projects-sessions/tracker-health-service/rotateTrackerLog';
import { healthyHubStatus, privateHealthFile } from '../../support/trackerHealthFixture';
import { fixture, inTemp, night, noon } from '../../support/trackerHealthHarness';
import { withTempDir } from '../../support/temporary';

inTemp('a down API posts to the private fallback webhook even overnight', async (root) => {
	const { api, service, clock, posted } = await fixture(root);
	await api.close();
	privateHealthFile(join(root, 'health-fallback.url'), 'https://alerts.example.test/hook\n');
	privateHealthFile(join(root, 'health-fallback.key'), 'synthetic-fallback-key\n');
	clock.now = night;
	const report = await service.run({ alert: true });
	expect(report.failing.map(({ name }) => name)).toContain('api');
	expect(posted).toHaveLength(1);
	expect(posted[0]).toMatchObject({
		url: 'https://alerts.example.test/hook',
		authorization: 'Bearer synthetic-fallback-key'
	});
	expect(JSON.parse(posted[0].body)).toMatchObject({
		event: 'tracker_health',
		node: 'fixture-hub'
	});
	expect(posted[0].body).not.toContain('synthetic-fallback-key');
	await service.run({ alert: true });
	expect(posted).toHaveLength(1);
});

inTemp(
	'a broken webhook holds the fallback during quiet hours and sends it after',
	async (root) => {
		const status = healthyHubStatus();
		status.webhook.configured = false;
		const { service, clock, posted } = await fixture(root, status);
		privateHealthFile(join(root, 'health-fallback.url'), 'https://alerts.example.test/hook');
		privateHealthFile(join(root, 'health-fallback.key'), 'synthetic-fallback-key');
		clock.now = night;
		await service.run({ alert: true });
		expect(posted).toHaveLength(0);
		clock.now = noon + 24 * 3600_000;
		await service.run({ alert: true });
		expect(posted).toHaveLength(1);
	}
);

test('log rotation copies then truncates so an appending writer keeps its file', () =>
	withTempDir('hth-', async (dir) => {
		const log = join(dir, 'tracker.log');
		writeFileSync(log, 'a'.repeat(64));
		expect(rotateTrackerLog(log, 128)).toBe(false);
		const inode = statSync(log).ino;
		expect(rotateTrackerLog(log, 32)).toBe(true);
		appendFileSync(log, 'next');
		expect(statSync(log).ino).toBe(inode);
		expect(readFileSync(log, 'utf8')).toBe('next');
		expect(readFileSync(log + '.1', 'utf8')).toBe('a'.repeat(64));
		expect(rotateTrackerLog(join(dir, 'missing.log'), 32)).toBe(false);
	}));
