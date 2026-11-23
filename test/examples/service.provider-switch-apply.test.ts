import type { Selection } from './service.provider-switch-apply.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ProviderSwitchApplyService } from '../../src/services/agents-providers/ProviderSwitchApplyService';
import type {
	SessionControl,
	SessionObservation,
	SwitchRequest,
	SwitchStore
} from '../../src/core/development-tooling/pickerTypes';

const CODEX = 'codex-session_7';
const before: Selection = { provider: 'openai', model: 'gpt-5', effort: 'low' };
const target: Selection = { provider: 'harness-claude', model: 'claude-x', effort: 'high' };
const wrong: Selection = { ...target, model: 'claude-y' };

function observe(selection: Selection, overrides: Partial<SessionObservation> = {}): SessionObservation {
	return { selection, idle: true, clients: 0, observedAt: new Date().toISOString(), ...overrides };
}

function pending(): SwitchRequest {
	return {
		id: 'req-1',
		sessionId: CODEX,
		target,
		status: 'pending',
		createdAt: '2026-11-16T10:00:00.000Z',
		reason: 'Queued by the picker.'
	};
}

function memoryStore(initial: SwitchRequest, ownership = true) {
	let current: SwitchRequest | null = initial;
	const writes: SwitchRequest[] = [];
	const store: SwitchStore = {
		get: () => current,
		put: (record) => {
			if (!ownership) return false;
			current = record;
			writes.push(record);
			return true;
		},
		list: () => (current ? [current] : [])
	};
	return { store, latest: () => current };
}

function fakeControl(observations: SessionObservation[], resumes: Selection[]): SessionControl {
	let reads = 0;
	return {
		inspect: () => {
			const next = observations[Math.min(reads, observations.length - 1)];
			reads += 1;
			return Promise.resolve(next);
		},
		resume: (_sessionId: string, selection: Selection) => {
			resumes.push(selection);
			return Promise.resolve();
		}
	};
}

function summarize(record: SwitchRequest | null, resumes: Selection[]) {
	return { status: record?.status ?? null, reason: record?.reason ?? null, resumes };
}

function recordState(state: string, name: string, input: unknown, output: unknown): void {
	recordExampleCases(
		{
			unitId: 'service.provider-switch-apply',
			symbol: 'apply',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name, input, output }]
	);
}

test('Applies a pending switch after idle verification', async () => {
	const { store, latest } = memoryStore(pending());
	const resumes: Selection[] = [];
	const control = fakeControl([observe(before), observe(before), observe(target)], resumes);
	await new ProviderSwitchApplyService(store, control).apply(CODEX);

	const outcome = summarize(latest(), resumes);
	expect(outcome.status).toBe('applied');
	expect(resumes).toEqual([target]);
	recordState(
		'applies-a-pending-switch-after-idle-verification',
		'pending request on an idle session with no clients is applied',
		{ sessionId: CODEX, target },
		outcome
	);
});

test('Restores the previous provider after a failed verification', async () => {
	const { store, latest } = memoryStore(pending());
	const resumes: Selection[] = [];
	const control = fakeControl(
		[observe(before), observe(before), observe(wrong), observe(before)],
		resumes
	);
	await new ProviderSwitchApplyService(store, control).apply(CODEX);

	const outcome = summarize(latest(), resumes);
	expect(outcome.status).toBe('failed');
	expect(outcome.reason).toContain('previous provider settings restored and verified');
	expect(resumes).toEqual([target, before]);
	recordState(
		'restores-the-previous-provider-after-a-failed-verification',
		'model mismatch after resume rolls back to the previous selection',
		{ sessionId: CODEX, target, observedAfterResume: wrong },
		outcome
	);
});

test('Skips a request that is not pending or has clients', async () => {
	const applied = memoryStore({ ...pending(), status: 'applied' });
	const busy = memoryStore(pending());
	const resumesApplied: Selection[] = [];
	const resumesBusy: Selection[] = [];
	await new ProviderSwitchApplyService(
		applied.store,
		fakeControl([observe(before)], resumesApplied)
	).apply(CODEX);
	await new ProviderSwitchApplyService(
		busy.store,
		fakeControl([observe(before, { clients: 1 })], resumesBusy)
	).apply(CODEX);

	const skippedApplied = summarize(applied.latest(), resumesApplied);
	const skippedBusy = summarize(busy.latest(), resumesBusy);
	expect(skippedApplied.status).toBe('applied');
	expect(skippedBusy.status).toBe('pending');
	expect([...resumesApplied, ...resumesBusy]).toEqual([]);
	recordExampleCases(
		{
			unitId: 'service.provider-switch-apply',
			symbol: 'apply',
			state: 'skips-a-request-that-is-not-pending-or-has-clients',
			evidence: 'examples-cases',
			file: 'skips-a-request-that-is-not-pending-or-has-clients.json'
		},
		[
			{
				name: 'an already applied request is left unchanged',
				input: { status: 'applied' },
				output: skippedApplied
			},
			{
				name: 'a pending request on a session with one client is not changed',
				input: { status: 'pending', clients: 1 },
				output: skippedBusy
			}
		]
	);
});

test('Rejects an invalid session ID without resuming', async () => {
	const { store } = memoryStore(pending());
	const resumes: Selection[] = [];
	const service = new ProviderSwitchApplyService(store, fakeControl([observe(before)], resumes));
	let error: unknown;
	try {
		await service.apply('bad id!');
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('A valid explicit Codex session ID is required.');
	expect(resumes).toEqual([]);
	recordState(
		'rejects-an-invalid-session-id-without-resuming',
		'an ID with a space and punctuation throws before any resume',
		{ sessionId: 'bad id!' },
		{ name: (error as Error).name, message: (error as Error).message, resumes }
	);
});

test('Leaves a request alone when another owner claims it first', async () => {
	const { store, latest } = memoryStore(pending(), false);
	const resumes: Selection[] = [];
	const control = fakeControl([observe(before), observe(before), observe(target)], resumes);
	await new ProviderSwitchApplyService(store, control).apply(CODEX);

	const outcome = summarize(latest(), resumes);
	expect(outcome.status).toBe('pending');
	expect(resumes).toEqual([]);
	recordState(
		'leaves-a-request-alone-when-another-owner-claims-it-first',
		'revision-checked claim fails so no settings are changed',
		{ sessionId: CODEX, claimed: false },
		outcome
	);
});
