import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gatewayTypes } from '../../src/cli/program/codex-gateway-service/codex-session-repository/gatewayTypes';

test('Creates a fresh gateway session state', () => {
	const session = gatewayTypes('session-001');
	const summary = {
		id: session.id,
		controllerCreated: session.controller instanceof globalThis.AbortController,
		pendingCount: session.pending.size,
		deliveredCount: session.delivered.size,
		running: session.running,
		replaysCount: session.replays.size,
		emitOmitted: session.emit === undefined
	};

	expect(summary).toEqual({
		id: 'session-001',
		controllerCreated: true,
		pendingCount: 0,
		deliveredCount: 0,
		running: false,
		replaysCount: 0,
		emitOmitted: true
	});
	recordExampleCases(
		{
			unitId: 'function.gateway-types',
			symbol: 'gatewayTypes',
			state: 'creates-a-fresh-gateway-session-state',
			evidence: 'examples-cases',
			file: 'creates-a-fresh-gateway-session-state.json'
		},
		[
			{
				name: 'new session starts with empty mutable state',
				input: { id: 'session-001' },
				output: summary
			}
		]
	);
});
