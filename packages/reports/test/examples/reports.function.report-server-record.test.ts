import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { stopReportServer } from '../../src/services/reports-media/report-command-service/report-server-service/reportServerRecord';
import { reportServerRecord } from '../../src/utils/reports-media/reportServerRecord';
import type { ServerRecord } from '../../src/utils/reports-media/reportServerRecord.types';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const stateForRecord = 'report-server-record-round-trips-a-server-identity';
const stateForStop = 'stopping-without-a-record-reports-absence';

function temporaryRoot(): string {
	return mkdtempSync(join(tmpdir(), 'report-server-record-'));
}

function removeRoot(root: string): void {
	rmSync(root, { recursive: true, force: true });
}

test('Report server record round trips a server identity', async () => {
	const root = temporaryRoot();
	const server: ServerRecord = {
		pid: 28411,
		port: 4173,
		started: 'Mon Jun 15 09:23:48 2026',
		buildId: 'reports-build-example'
	};
	try {
		const record = reportServerRecord(root, server.port);
		await record.write(server);
		const output = await record.read();
		expect(output).toEqual(server);
		await record.remove();
		expect(await record.read()).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'reports.function.report-server-record',
				symbol: 'reportServerRecord',
				state: stateForRecord,
				evidence: 'examples-cases',
				file: `${stateForRecord}.json`
			},
			[
				{
					name: 'write and read a recorded process identity',
					input: { root: '<temporary-root>', port: server.port, record: server },
					output: { file: `servers/${server.port}.json`, record: output }
				},
				{
					name: 'remove the recorded identity',
					input: { root: '<temporary-root>', port: server.port },
					output: { record: undefined }
				}
			]
		);
	} finally {
		removeRoot(root);
	}
});

test('Stopping without a record reports absence', async () => {
	const root = temporaryRoot();
	try {
		const output = await stopReportServer(root, 4173);
		expect(output).toEqual({
			port: 4173,
			stopped: false,
			reason: 'This report store recorded no server on this port.'
		});
		recordExampleCases(
			{
				unitId: 'reports.function.report-server-record',
				symbol: 'stopReportServer',
				state: stateForStop,
				evidence: 'examples-cases',
				file: `${stateForStop}.json`
			},
			[
				{
					name: 'requested port has no server record',
					input: { root: '<temporary-root>', port: 4173 },
					output
				}
			]
		);
	} finally {
		removeRoot(root);
	}
});

test('Throws SyntaxError when a server record contains malformed JSON', async () => {
	const root = temporaryRoot();
	const state = 'throws-syntaxerror-when-a-server-record-contains-malformed-j';
	try {
		const record = reportServerRecord(root, 4173);
		mkdirSync(join(root, 'servers'));
		writeFileSync(record.file, '{malformed');
		await expect(record.read()).rejects.toThrow(SyntaxError);
		recordExampleCases(
			{
				unitId: 'reports.function.report-server-record',
				symbol: 'reportServerRecord.read',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{
					name: 'malformed record JSON rejects reading',
					input: { root: '<temporary-root>', port: 4173, contents: '{malformed' },
					error: { name: 'SyntaxError' }
				}
			]
		);
	} finally {
		removeRoot(root);
	}
});

test('Throws Error when writing a record cannot create its directory', async () => {
	const root = temporaryRoot();
	const state = 'throws-error-when-writing-a-record-cannot-create-its-directo';
	try {
		const blockedRoot = join(root, 'blocked');
		writeFileSync(blockedRoot, 'file prevents directory creation');
		const record = reportServerRecord(join(blockedRoot, 'child'), 4173);
		const server: ServerRecord = {
			pid: 28411,
			port: 4173,
			started: 'Mon Jun 15 09:23:48 2026',
			buildId: 'reports-build-example'
		};
		await expect(record.write(server)).rejects.toThrow(Error);
		recordExampleCases(
			{
				unitId: 'reports.function.report-server-record',
				symbol: 'reportServerRecord.write',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{
					name: 'filesystem rejects parent directory creation',
					input: { root: '<temporary-root>/blocked/child', port: 4173, record: server },
					error: { name: 'Error' }
				}
			]
		);
	} finally {
		removeRoot(root);
	}
});
