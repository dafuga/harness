import { expect, test } from 'vitest';
import { reportServerEnvironment } from '../src/services/reports-media/report-command-service/report-server-service/ReportServerService';

// The Node adapter derives request.url from ORIGIN; without it the server believed it was
// https://127.0.0.1:<port>, and the /api/agent owner check refused `harness api --url http://...`.
test('a loopback report server knows the exact http origin it is reached at', () => {
	const env = reportServerEnvironment(5791, { HARNESS_SITE_ROOT: '/site', PATH: '/bin' }, '/cwd');
	expect(env.ORIGIN).toBe('http://127.0.0.1:5791');
	expect(new URL(env.ORIGIN!).origin).toBe(`http://${env.HOST}:${env.PORT}`);
	expect(env).toMatchObject({
		HARNESS_OWNER_MODE: 'loopback',
		HARNESS_BIND: '127.0.0.1',
		HARNESS_SITE_ROOT: '/site'
	});
	expect(reportServerEnvironment(5588, {}, '/cwd').HARNESS_SITE_ROOT).toBe('/cwd');
});
