import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	desktopControlUnavailable,
	switchRevision
} from '../../src/core/development-tooling/pickerTypes';
import type { SwitchRequest } from '../../src/core/development-tooling/pickerTypes.types';

const pendingRequest = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	sessionId: 'codex-session-01',
	target: {
		provider: 'harness-claude',
		model: 'claude-opus-5-5',
		effort: 'xhigh'
	},
	status: 'pending',
	createdAt: '2026-11-14T10:00:00.000Z',
	reason: desktopControlUnavailable
} satisfies SwitchRequest;

test('Desktop control notice keeps requests pending', () => {
	expect(desktopControlUnavailable).toBe(
		'Desktop control connection unavailable. Requests stay pending; no provider settings change.'
	);
	recordExampleCases(
		{
			unitId: 'function.picker-types',
			symbol: 'desktopControlUnavailable',
			state: 'desktop-control-notice-keeps-requests-pending',
			evidence: 'examples-cases',
			file: 'desktop-control-notice-keeps-requests-pending.json'
		},
		[
			{
				name: 'desktop control is unavailable',
				input: {},
				output: desktopControlUnavailable
			}
		]
	);
});

test('Switch revision reflects request id and status', () => {
	const pendingRevision = switchRevision(pendingRequest);
	const absentRevision = switchRevision(null);
	expect([pendingRevision, absentRevision]).toEqual([
		'550e8400-e29b-41d4-a716-446655440000:pending',
		null
	]);
	recordExampleCases(
		{
			unitId: 'function.picker-types',
			symbol: 'switchRevision',
			state: 'switch-revision-reflects-request-id-and-status',
			evidence: 'examples-cases',
			file: 'switch-revision-reflects-request-id-and-status.json'
		},
		[
			{
				name: 'pending switch has an id and status marker',
				input: pendingRequest,
				output: pendingRevision
			},
			{ name: 'no switch has no revision marker', input: null, output: absentRevision }
		]
	);
});
