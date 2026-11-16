import { test } from 'vitest';
import { recordCommandAnalytics } from '../../src/workflows/reports-media/recordCommandAnalytics';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Records a command event through the supplied recorder', async () => {
	let event: unknown;
	const startedAt = Date.now() - 25;
	await recordCommandAnalytics(['analytics', 'summary'], startedAt, '1', async (value) => {
		event = value;
	});

	expect(event).toMatchObject({ kind: 'command', exitCode: 1 });
	expect(event).toMatchObject({ kind: 'command', action: 'analytics summary', exitCode: 1 });
	expect(event).toHaveProperty('durationMs');
	recordExampleCases(
		{
			unitId: 'workflow.reports-media-record-command-analytics',
			symbol: 'recordCommandAnalytics',
			state: 'records-a-command-event-through-the-supplied-recorder',
			evidence: 'examples-cases',
			file: 'records-a-command-event-through-the-supplied-recorder.json'
		},
		[
			{
				name: 'records an analytics command and converts its string exit code',
				input: { args: ['analytics', 'summary'], startedAt, exitCode: '1' },
				output: event
			}
		]
	);
});

test('Skips recording lookup-only arguments', async () => {
	let called = false;
	await recordCommandAnalytics(['help'], Date.now(), 0, async () => {
		called = true;
	});

	expect(called).toBe(false);
	recordExampleCases(
		{
			unitId: 'workflow.reports-media-record-command-analytics',
			symbol: 'recordCommandAnalytics',
			state: 'skips-recording-lookup-only-arguments',
			evidence: 'examples-cases',
			file: 'skips-recording-lookup-only-arguments.json'
		},
		[{ name: 'help does not invoke the recorder', input: { args: ['help'], exitCode: 0 }, output: { called } }]
	);
});
