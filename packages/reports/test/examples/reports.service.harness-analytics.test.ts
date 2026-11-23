import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HarnessAnalyticsService } from '../../src/services/explorer-ui/HarnessAnalyticsService';
import { HarnessAnalyticsQueryError } from '../../src/services/explorer-ui/HarnessAnalyticsService.types';
import type { AnalyticsSnapshot } from '../../src/services/explorer-ui/HarnessAnalyticsService.types';

const SNAPSHOT_JSON = JSON.stringify({
	schemaVersion: 1,
	filters: { loop: 'analytics-backfill' },
	summary: { events: 2, projects: 1 },
	loops: [],
	events: []
});

const directories: string[] = [];

afterEach(() => {
	vi.unstubAllEnvs();
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

// Writes a fake executable into a new temporary directory and points the service at it.
// The fake records its arguments one per line in args.txt, prints stdout and exits with exitCode.
function fakeBun(stdout: string, exitCode: number): string {
	const directory = mkdtempSync(join(tmpdir(), 'harness-analytics-'));
	directories.push(directory);
	const bunPath = join(directory, 'fake-bun.sh');
	writeFileSync(
		bunPath,
		`#!/bin/sh\nprintf '%s\\n' "$@" > "${directory}/args.txt"\nprintf '%s' '${stdout}'\nexit ${exitCode}\n`
	);
	chmodSync(bunPath, 0o755);
	vi.stubEnv('HARNESS_BUN_PATH', bunPath);
	vi.stubEnv('HARNESS_CLI_PATH', '/workspace/harness/src/index.ts');
	vi.stubEnv('HARNESS_SITE_ROOT', directory);
	return directory;
}

function readArgs(directory: string): string[] {
	return readFileSync(join(directory, 'args.txt'), 'utf8')
		.split('\n')
		.filter((line) => line !== '');
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
		return undefined;
	} catch (caught) {
		return caught;
	}
}

test('Forwards only nonempty loop and since parameters to the CLI', async () => {
	const directory = fakeBun(SNAPSHOT_JSON, 0);
	const params = new URLSearchParams(
		'loop=analytics-backfill&task=&project=other-app&since=2026-11-01T00:00:00.000Z'
	);
	const snapshot: AnalyticsSnapshot = await new HarnessAnalyticsService().snapshot(params);
	const args = readArgs(directory);

	expect(snapshot.summary.events).toBe(2);
	expect(args.slice(-4)).toEqual([
		'--loop',
		'analytics-backfill',
		'--since',
		'2026-11-01T00:00:00.000Z'
	]);
	expect(args).not.toContain('--task');
	expect(args).not.toContain('--project');
	recordExampleCases(
		{
			unitId: 'reports.service.harness-analytics',
			symbol: 'snapshot',
			state: 'forwards-only-nonempty-loop-and-since-parameters-to-the-cli',
			evidence: 'examples-cases',
			file: 'forwards-only-nonempty-loop-and-since-parameters-to-the-cli.json'
		},
		[
			{
				name: 'empty task and unknown project are dropped; loop and since are forwarded',
				input: { query: params.toString() },
				output: { events: snapshot.summary.events, forwarded: args.slice(6) }
			}
		]
	);
});

test('Rejects with a query error when the CLI exits non-zero', async () => {
	fakeBun('', 3);
	const error = await captureError(
		new HarnessAnalyticsService().snapshot(new URLSearchParams('model=claude-sonnet-5-5'))
	);

	expect(error).toBeInstanceOf(HarnessAnalyticsQueryError);
	expect((error as Error).message).toBe('Harness analytics query failed.');
	recordExampleCases(
		{
			unitId: 'reports.service.harness-analytics',
			symbol: 'snapshot',
			state: 'rejects-with-a-query-error-when-the-cli-exits-non-zero',
			evidence: 'examples-cases',
			file: 'rejects-with-a-query-error-when-the-cli-exits-non-zero.json'
		},
		[
			{
				name: 'exit code 3 rejects with the fixed query failure message',
				input: { query: 'model=claude-sonnet-5-5', exitCode: 3 },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('Rejects with a SyntaxError when the CLI prints invalid JSON', async () => {
	fakeBun('not json', 0);
	const error = await captureError(new HarnessAnalyticsService().snapshot(new URLSearchParams()));

	expect(error).toBeInstanceOf(SyntaxError);
	recordExampleCases(
		{
			unitId: 'reports.service.harness-analytics',
			symbol: 'snapshot',
			state: 'rejects-with-a-syntaxerror-when-the-cli-prints-invalid-json',
			evidence: 'examples-cases',
			file: 'rejects-with-a-syntaxerror-when-the-cli-prints-invalid-json.json'
		},
		[
			{
				name: 'exit code 0 with non-JSON stdout rejects with a SyntaxError',
				input: { query: '', stdout: 'not json', exitCode: 0 },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
