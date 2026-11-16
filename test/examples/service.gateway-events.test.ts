import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { GatewayEventsService } from '../../src/serializers/agents-providers/claude-tools-serializer/GatewayEventsService';
import type { GatewaySession } from '../../src/utils/development-tooling/gatewayTypes';

const DONE_DELAY_MS = 50;
const SESSION_ID = 'session-1';

function makeSession(events: unknown[]): GatewaySession {
	return {
		id: SESSION_ID,
		controller: new AbortController(),
		pending: new Map(),
		delivered: new Set(),
		emit: (event) => {
			events.push(event);
		},
		running: true,
		replays: new Map()
	};
}

test('Emits one done event for a finished tool batch', () => {
	vi.useFakeTimers();
	try {
		const events: unknown[] = [];
		const service = new GatewayEventsService();
		service.finishToolBatch(makeSession(events));
		expect(events).toEqual([]);
		vi.advanceTimersByTime(DONE_DELAY_MS);
		expect(events).toEqual([{ type: 'done' }]);
		recordExampleCases(
			{
				unitId: 'service.gateway-events',
				symbol: 'finishToolBatch',
				state: 'emits-one-done-event-for-a-finished-tool-batch',
				evidence: 'examples-cases',
				file: 'emits-one-done-event-for-a-finished-tool-batch.json'
			},
			[
				{
					name: 'finished batch emits done after 50 ms',
					input: { sessionId: SESSION_ID, elapsedMs: DONE_DELAY_MS },
					output: { events: [{ type: 'done' }] }
				}
			]
		);
	} finally {
		vi.useRealTimers();
	}
});

test('Ignores a repeat finish call while the done event is pending', () => {
	vi.useFakeTimers();
	try {
		const events: unknown[] = [];
		const service = new GatewayEventsService();
		const session = makeSession(events);
		service.finishToolBatch(session);
		service.finishToolBatch(session);
		vi.advanceTimersByTime(DONE_DELAY_MS);
		expect(events).toEqual([{ type: 'done' }]);
		recordExampleCases(
			{
				unitId: 'service.gateway-events',
				symbol: 'finishToolBatch',
				state: 'ignores-a-repeat-finish-call-while-the-done-event-is-pending',
				evidence: 'examples-cases',
				file: 'ignores-a-repeat-finish-call-while-the-done-event-is-pending.json'
			},
			[
				{
					name: 'second call for the same session before the timer fires is dropped',
					input: { sessionId: SESSION_ID, calls: 2 },
					output: { events: [{ type: 'done' }] }
				}
			]
		);
	} finally {
		vi.useRealTimers();
	}
});

test('Throws a TypeError when the session is missing', () => {
	const service = new GatewayEventsService();
	let error: unknown;
	try {
		service.finishToolBatch(null as unknown as GatewaySession);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId: 'service.gateway-events',
			symbol: 'finishToolBatch',
			state: 'throws-a-typeerror-when-the-session-is-missing',
			evidence: 'examples-cases',
			file: 'throws-a-typeerror-when-the-session-is-missing.json'
		},
		[
			{
				name: 'null session fails on session.id before any scheduling',
				input: { session: null },
				error: {
					name: (error as Error).name,
					message: (error as Error).message
				}
			}
		]
	);
});
