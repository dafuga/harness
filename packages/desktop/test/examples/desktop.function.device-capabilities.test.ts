import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { deviceCapabilities } from '../../src/services/networking-security/remote-host-service/device-session-service/device-operations-service/deviceCapabilities';

const PENDING_REASON = 'Comments are saved on the computer as pending drafts until connected.';
const READ_COMMENT_REASON = 'This device was approved to read and comment only.';
const READ_REASON = 'This device has Read access.';

test('Grants agents, planning and approval when comments are on', () => {
	const withDefault = deviceCapabilities(true);
	const explicit = deviceCapabilities(true, true);

	expect(withDefault).toEqual({
		comments: true,
		agents: true,
		planning: true,
		approval: true,
		source: 'local',
		reason: PENDING_REASON
	});
	expect(explicit).toEqual(withDefault);

	recordExampleCases(
		{
			unitId: 'desktop.function.device-capabilities',
			symbol: 'deviceCapabilities',
			state: 'grants-agents-planning-and-approval-when-comments-are-on',
			evidence: 'examples-cases',
			file: 'grants-agents-planning-and-approval-when-comments-are-on.json'
		},
		[
			{ name: 'agents on, comments defaulted to true', input: { agents: true }, output: withDefault },
			{ name: 'agents on, comments explicitly true', input: { agents: true, comments: true }, output: explicit }
		]
	);
});

test('Limits a device to read and comment when agents are off', () => {
	const defaulted = deviceCapabilities(false);
	const explicit = deviceCapabilities(false, true);

	expect(defaulted).toMatchObject({
		comments: true,
		agents: false,
		planning: false,
		approval: false,
		source: 'local',
		reason: READ_COMMENT_REASON
	});
	expect(explicit).toEqual(defaulted);

	recordExampleCases(
		{
			unitId: 'desktop.function.device-capabilities',
			symbol: 'deviceCapabilities',
			state: 'limits-a-device-to-read-and-comment-when-agents-are-off',
			evidence: 'examples-cases',
			file: 'limits-a-device-to-read-and-comment-when-agents-are-off.json'
		},
		[
			{ name: 'agents off, comments defaulted to true', input: { agents: false }, output: defaulted },
			{ name: 'agents off, comments explicitly true', input: { agents: false, comments: true }, output: explicit }
		]
	);
});

test('Removes every write permission when comments are off', () => {
	const agentsRequested = deviceCapabilities(true, false);
	const readOnly = deviceCapabilities(false, false);

	expect(agentsRequested).toMatchObject({
		comments: false,
		agents: false,
		planning: false,
		approval: false,
		source: 'local',
		reason: READ_REASON
	});
	expect(readOnly).toEqual(agentsRequested);

	recordExampleCases(
		{
			unitId: 'desktop.function.device-capabilities',
			symbol: 'deviceCapabilities',
			state: 'removes-every-write-permission-when-comments-are-off',
			evidence: 'examples-cases',
			file: 'removes-every-write-permission-when-comments-are-off.json'
		},
		[
			{
				name: 'agents requested but comments off forces read access',
				input: { agents: true, comments: false },
				output: agentsRequested
			},
			{ name: 'agents off and comments off', input: { agents: false, comments: false }, output: readOnly }
		]
	);
});
