import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CodexSessionRepository } from '../../src/cli/program/codex-gateway-service/codex-session-repository/CodexSessionRepository';

test('Creates and reuses a live Codex session', () => {
	const repository = new CodexSessionRepository();
	const first = repository.create('codex-session-2026-11-14-01');
	const reused = repository.create('codex-session-2026-11-14-01');
	expect(reused).toBe(first);
	recordExampleCases(
		{
			unitId: 'repository.codex-session',
			symbol: 'create',
			state: 'creates-and-reuses-a-live-codex-session',
			evidence: 'examples-cases',
			file: 'creates-and-reuses-a-live-codex-session.json'
		},
		[
			{
				name: 'live ID returns its stored session',
				input: { id: first.id },
				output: { id: reused.id, reused: reused === first }
			}
		]
	);
});

test('Resolves a pending tool call and marks it delivered', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('codex-session-2026-11-14-01');
	const result = repository.waitForTool(session, 'call_8f31');
	repository.deliver(session, [{ call_id: 'call_8f31', output: { status: 'reserved' } }]);
	const output = await result;
	expect(output).toBe('{"status":"reserved"}');
	expect(session.delivered.has('call_8f31')).toBe(true);
	recordExampleCases(
		{
			unitId: 'repository.codex-session',
			symbol: 'deliver',
			state: 'resolves-a-pending-tool-call-and-marks-it-delivered',
			evidence: 'examples-cases',
			file: 'resolves-a-pending-tool-call-and-marks-it-delivered.json'
		},
		[
			{
				name: 'object output resolves as JSON text',
				input: { call_id: 'call_8f31', output: { status: 'reserved' } },
				output: {
					value: output,
					delivered: session.delivered.has('call_8f31'),
					pending: session.pending.size
				}
			}
		]
	);
});

test('Rejects a duplicate tool call ID', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('codex-session-2026-11-14-01');
	const pending = repository.waitForTool(session, 'call_8f31');
	let error: unknown;
	try {
		void repository.waitForTool(session, 'call_8f31');
	} catch (caught) {
		error = caught;
	}
	repository.cancel(session);
	await pending.catch(() => undefined);
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('Duplicate call');
	recordExampleCases(
		{
			unitId: 'repository.codex-session',
			symbol: 'waitForTool',
			state: 'rejects-a-duplicate-tool-call-id',
			evidence: 'examples-cases',
			file: 'rejects-a-duplicate-tool-call-id.json'
		},
		[
			{
				name: 'already pending call ID throws',
				input: { id: 'call_8f31' },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('Cancels a session and rejects pending calls', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('codex-session-2026-11-14-01');
	const pending = repository.waitForTool(session, 'call_8f31');
	repository.cancel(session);
	const error = await pending.catch((caught: unknown) => caught);
	expect(session.controller.signal.aborted).toBe(true);
	expect(session.pending.size).toBe(0);
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'repository.codex-session',
			symbol: 'cancel',
			state: 'cancels-a-session-and-rejects-pending-calls',
			evidence: 'examples-cases',
			file: 'cancels-a-session-and-rejects-pending-calls.json'
		},
		[
			{
				name: 'pending call rejects and session state is cleared',
				input: { id: 'call_8f31' },
				output: {
					aborted: session.controller.signal.aborted,
					pending: session.pending.size,
					rejection: (error as Error).message
				}
			}
		]
	);
});
