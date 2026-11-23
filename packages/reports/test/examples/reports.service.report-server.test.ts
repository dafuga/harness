import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	reportServerEnvironment,
	ReportServerService
} from '../../src/services/reports-media/report-command-service/report-server-service/ReportServerService';
import { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';

test('Builds a loopback environment from inherited values', () => {
	const result = reportServerEnvironment(
		5588,
		{ PATH: '/usr/local/bin', CI: 'true' },
		'/workspace/project'
	);
	expect(result).toMatchObject({
		PATH: '/usr/local/bin',
		CI: 'true',
		HOST: '127.0.0.1',
		PORT: '5588',
		ORIGIN: 'http://127.0.0.1:5588',
		BODY_SIZE_LIMIT: '110M',
		HARNESS_SITE_ROOT: '/workspace/project',
		HARNESS_OWNER_MODE: 'loopback',
		HARNESS_BIND: '127.0.0.1'
	});
	recordExampleCases(
		{
			unitId: 'reports.service.report-server',
			symbol: 'reportServerEnvironment',
			state: 'builds-a-loopback-environment-from-inherited-values',
			evidence: 'examples-cases',
			file: 'builds-a-loopback-environment-from-inherited-values.json'
		},
		[
			{
				name: 'sets loopback address and server settings while retaining inherited values',
				input: {
					port: 5588,
					base: { PATH: '/usr/local/bin', CI: 'true' },
					cwd: '/workspace/project'
				},
				output: result
			}
		]
	);
});

test('Leaves an unrecorded report server stopped', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-server-example-'));
	try {
		const service = new ReportServerService(new ReportRepository(root));
		const result = await service.stop(5588);
		expect(result).toMatchObject({
			port: 5588,
			stopped: false,
			reason: 'This report store recorded no server on this port.'
		});
		recordExampleCases(
			{
				unitId: 'reports.service.report-server',
				symbol: 'ReportServerService.stop',
				state: 'leaves-an-unrecorded-report-server-stopped',
				evidence: 'examples-cases',
				file: 'leaves-an-unrecorded-report-server-stopped.json'
			},
			[
				{
					name: 'returns the empty-record result for a temporary report store',
					input: { port: 5588 },
					output: result
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws Error when no free port is found', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-server-error-'));
	const servers = Array.from({ length: 30 }, () =>
		createServer((_request, response) => response.end())
	);
	try {
		await Promise.all(
			servers.map(
				(server, index) =>
					new Promise<void>((resolve, reject) => {
						server.once('error', reject);
						server.listen(5588 + index, '127.0.0.1', resolve);
					})
			)
		);
		const service = new ReportServerService(new ReportRepository(root));
		let caught: unknown;
		try {
			await service.serve(5588);
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'reports.service.report-server',
				symbol: 'ReportServerService.serve',
				state: 'throws-error-when-no-free-port-is-found',
				evidence: 'examples-cases',
				file: 'throws-error-when-no-free-port-is-found.json'
			},
			[
				{
					name: 'rejects after all thirty preferred ports are occupied',
					input: { preferred: 5588 },
					error: {
						name: 'ReportServerUnavailableError',
						message: 'No available loopback port from preferred range'
					}
				}
			]
		);
	} finally {
		await Promise.all(
			servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
		);
		rmSync(root, { recursive: true, force: true });
	}
});
