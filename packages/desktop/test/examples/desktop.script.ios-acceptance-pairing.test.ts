import { afterEach, test, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AcceptanceRecord } from '../../scripts/ios-acceptance-record';
import type { Acceptance } from '../../scripts/ios-acceptance-run';

const fixtures = vi.hoisted(() => ({
	status: vi.fn(),
	page: {
		reset: vi.fn(),
		until: vi.fn(),
		evaluate: vi.fn()
	},
	launch: vi.fn(),
	shot: vi.fn(),
	pause: vi.fn(),
	groups: vi.fn()
}));

vi.mock('../../scripts/ios-acceptance-run', () => ({
	computerName: 'Harness fixture computer',
	panelText: 'return panel();',
	pause: fixtures.pause,
	control: fixtures.status,
	offered: vi.fn(async () => ({ pairingId: 'pair-1', code: '123456', scan: 'fixture-scan' })),
	restart: vi.fn(async () => fixtures.page.reset()),
	scanPressed: vi.fn(async () => 'pressed'),
	shot: fixtures.shot
}));

vi.mock('../../scripts/ios-acceptance-simulator', () => ({
	keychainGroups: fixtures.groups,
	bundleId: 'com.dafuga.harness',
	launch: fixtures.launch
}));

import { pairing } from '../../scripts/ios-acceptance-pairing';

const key = '1234567890123456789012345678901234567890';
const directories: string[] = [];

afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

const pairingStates = new Map<string, string>([
	['does not accept', 'That code is for a relay this build of Harness does not accept.'],
	['Debug build for a test fixture', 'Connect to computer. Debug build for a test fixture'],
	['Waiting for approval', 'Waiting for approval'],
	['declined on your computer', 'Connect to computer; declined on your computer'],
	[
		'Connected to',
		`Connected to Harness fixture computer
Acceptance iPhone
Key ${key}`
	]
]);

function createRun(): Acceptance & { checks: string[] } {
	const output = mkdtempSync(join(tmpdir(), 'ios-pairing-'));
	directories.push(output);
	const checks: string[] = [];
	fixtures.page.until.mockImplementation(
		async (_script: string, expected: string) =>
			pairingStates.get(expected) ?? 'capacitor | Connect to computer | Scan QR code'
	);
	fixtures.page.evaluate.mockImplementation(async (script: string) =>
		script === 'return panel();' ? 'Waiting for approval' : 'safe page data'
	);
	const pending = [
		{ requests: [], devices: [] },
		{ requests: [{ deviceName: 'Acceptance iPhone' }], devices: [] },
		{ devices: [] },
		{ requests: [], devices: [] }
	];
	fixtures.status.mockImplementation(async (_run: unknown, path: string) => {
		if (path !== '/status') return {};
		return (
			pending.shift() ?? { devices: [{ online: true, name: 'Acceptance iPhone', deviceId: key }] }
		);
	});
	fixtures.groups
		.mockReturnValueOnce([])
		.mockReturnValueOnce([])
		.mockReturnValueOnce([])
		.mockReturnValueOnce(['com.dafuga.harness']);
	const record = new AcceptanceRecord(() => undefined);
	const run: Acceptance = {
		record,
		page: fixtures.page as unknown as Acceptance['page'],
		udid: 'fixture-device',
		controlOrigin: 'http://127.0.0.1:4100',
		project: { id: 'project-1', name: 'Pairing fixture' },
		output
	};
	return Object.assign(run, { checks });
}

test('pairs with the fixture computer after approval', async () => {
	const run = createRun();
	const result = await pairing(run);

	expect(result).toBeUndefined();
	expect(run.record.checks.length).toBeGreaterThan(10);
	expect(fixtures.shot).toHaveBeenLastCalledWith(run, 'paired');

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-pairing',
			symbol: 'pairing',
			state: 'pairs-with-the-fixture-computer-after-approval',
			evidence: 'examples-cases',
			file: 'pairs-with-the-fixture-computer-after-approval.json'
		},
		[
			{
				name: 'approved scan completes pairing and captures the paired screen',
				input: { project: run.project, controlOrigin: run.controlOrigin },
				output: { resolved: true, checks: run.record.checks.length, screenshot: 'paired' }
			}
		]
	);
});
