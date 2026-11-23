import type { Request, Session } from './service.claude-query.test.types';
import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ClaudeQueryService } from '../../src/cli/program/codex-gateway-service/claude-query-service/ClaudeQueryService';

// The Claude Agent SDK starts a model CLI, so only its query() is replaced by a
// scripted in-memory stream. Every other export of the SDK stays real.
const fake = vi.hoisted(() => ({
	messages: [] as unknown[],
	onStart: undefined as (() => void) | undefined
}));

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	query: () => fakeStream()
}));

async function* fakeStream(): AsyncGenerator<unknown> {
	fake.onStart?.();
	for (const message of fake.messages) yield message;
}

const request: Request = {
	model: 'claude-opus-5-5',
	stream: true,
	input: [
		{
			type: 'message',
			role: 'user',
			content: [
				{
					type: 'input_text',
					text: 'Rename formatDate to formatCalendarDate in src/utils/format.ts.'
				}
			]
		}
	],
	tools: []
};

function textDelta(text: string): unknown {
	return {
		type: 'stream_event',
		event: { type: 'content_block_delta', delta: { type: 'text_delta', text } }
	};
}

const toolDelta = {
	type: 'stream_event',
	event: { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } }
};
const successResult = { type: 'result', subtype: 'success' };
const failedResult = { type: 'result', subtype: 'error_during_execution' };

function setScript(messages: unknown[], onStart?: () => void): void {
	fake.messages = messages;
	fake.onStart = onStart;
}

function makeSession(events: unknown[]): Session {
	return {
		id: 'session-1',
		controller: new AbortController(),
		pending: new Map(),
		delivered: new Set(),
		running: false,
		replays: new Map(),
		emit: (event) => {
			events.push(event);
		}
	};
}

function makeService(cancelled: unknown[]): ClaudeQueryService {
	const repository = { cancel: (session: unknown) => cancelled.push(session) };
	return new ClaudeQueryService(
		repository as unknown as ConstructorParameters<typeof ClaudeQueryService>[0]
	);
}

function record(state: string, name: string, output: unknown): void {
	recordExampleCases(
		{
			unitId: 'service.claude-query',
			symbol: 'run',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name, input: request, output }]
	);
}

test('Streams text deltas and ends with a done event', async () => {
	await withTempDir('claude-query-stream-', async () => {
		setScript([textDelta('Renamed '), toolDelta, textDelta('formatDate.'), successResult]);
		const events: unknown[] = [];
		const cancelled: unknown[] = [];
		const session = makeSession(events);
		await makeService(cancelled).run(request, session);

		expect(events).toEqual([
			{ type: 'text', text: 'Renamed ' },
			{ type: 'text', text: 'formatDate.' },
			{ type: 'done' }
		]);
		expect(session.running).toBe(false);
		expect(cancelled).toHaveLength(0);
		record(
			'streams-text-deltas-and-ends-with-a-done-event',
			'text deltas are forwarded, tool deltas skipped',
			{
				events,
				running: session.running
			}
		);
	});
});

test('Emits a Claude query failure as an error event', async () => {
	await withTempDir('claude-query-failure-', async () => {
		setScript([failedResult]);
		const events: unknown[] = [];
		const cancelled: unknown[] = [];
		const session = makeSession(events);
		await makeService(cancelled).run(request, session);

		expect(events).toEqual([
			{ type: 'error', message: 'Claude query failed; no fallback was used' }
		]);
		expect(cancelled).toHaveLength(1);
		expect(cancelled[0]).toBe(session);
		record(
			'emits-a-claude-query-failure-as-an-error-event',
			'failed result reports error and cancels',
			{
				events,
				cancelledCount: cancelled.length
			}
		);
	});
});

test('Reports a cancelled session with the cancelled message', async () => {
	await withTempDir('claude-query-cancel-', async () => {
		const events: unknown[] = [];
		const cancelled: unknown[] = [];
		const session = makeSession(events);
		setScript([failedResult], () => session.controller.abort());
		await makeService(cancelled).run(request, session);

		expect(events).toEqual([{ type: 'error', message: 'Session cancelled' }]);
		expect(cancelled).toHaveLength(1);
		record(
			'reports-a-cancelled-session-with-the-cancelled-message',
			'aborted signal selects the cancelled message',
			{
				events,
				cancelledCount: cancelled.length
			}
		);
	});
});
