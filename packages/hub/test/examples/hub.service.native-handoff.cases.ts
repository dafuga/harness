import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { memoryAuthStore } from '../support/memoryAuthStore';
import {
	HANDOFF_TTL,
	NativeHandoffService,
	POLL_INTERVAL
} from '../../src/lib/verification-evidence/server/auth/native-handoff-service/NativeHandoffService';
import type { NativeHandoffOptions } from '../../src/lib/verification-evidence/server/auth/native-handoff-service/NativeHandoffService.types';
import { normalizeCode } from '../../src/lib/verification-evidence/server/auth/native-handoff-service/authSecrets';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { sha256Url } from '../../src/utils/verification-evidence/authSecrets';
import type { Desktop, Begun, Case } from './hub.service.native-handoff.test.types';

const ORIGIN = 'https://hub.example.com';
const START = Date.parse('2026-11-15T09:00:00.000Z');
const USER_CODE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const REFUSED = {
	name: 'AuthFailure',
	code: 'handoff-invalid',
	status: 400,
	message: 'Hub auth handoff-invalid'
};
export const projects: Desktop = {
	verifier: '3rFw9KzQ1mVbX7tHc0LyE5nSaJ8uPdGo2iWq4ZkRxT6',
	nonce: 'Xb3Qp9rT1wZk7LmV0cNa4Hs8JdYe2UgF',
	resource: 'projects'
};
export const project: Desktop = {
	verifier: 'Qa7Lr2Wn9TzXb4KdM1vHs8JyE0cUgP6oRi3FtZ5wNkA',
	nonce: 'Lp0sVw8Ke3RtQ5zYn1XaBc7HdGm6JuTi',
	resource: 'project:3f2a9c1e-6b7d-4e8a-9f01-2c3d4e5f6a7b'
};
/** The contract's start examples: each challenge is stored as given; nonce and resource match. */
const starts: Array<[string, Desktop]> = [
	['Tn8bQ2vLr5xWcZ0yKe7HaM4sJdP9gUoF3iXq1RkNwYA', projects],
	['vD4kR8mQ2sLx0ZnW6aYt3BcJ9eHuPf7NgTo5iKrE1qA', project]
];
export const approver: SessionRecord = {
	idHash: '5f0c9a2e7d41b8c36e1a0f9d24b7c8e53a6d91f0b2c4e7a8d3f6b1c9e0a2d4f7',
	kind: 'browser',
	parentHash: null,
	actor: {
		id: 'google-110248697315628390471',
		email: 'ada@example.com',
		name: 'Ada Park',
		emailVerified: true
	},
	resource: 'projects',
	createdAt: 1794731400000,
	expiresAt: 1795336200000,
	revokedAt: null
};

/** The service as composeHubAuth builds it, over the in-memory auth store and a clock the test moves. */
export function fixture() {
	const clock = { now: START };
	const now = () => clock.now;
	const store = memoryAuthStore();
	const secrets = authSecrets('synthetic-session-secret-0123456789abcdef');
	const sessions = new SessionRepository({ store: store.sessions, secrets, now });
	const options: NativeHandoffOptions = {
		store: store.exchanges,
		sessions,
		secrets,
		origin: ORIGIN,
		environment: 'staging',
		now
	};
	return { service: new NativeHandoffService(options), store, sessions, clock };
}

/** The desktop derives its challenge from its verifier, then starts a handoff. */
export async function begin(service: NativeHandoffService, desktop: Desktop) {
	const challenge = await sha256Url(desktop.verifier);
	const started = await service.start({
		challenge,
		nonce: desktop.nonce,
		resource: desktop.resource
	});
	return { ...started, desktop };
}

/** The approval page sends the code normalized: uppercase, with the dash removed. */
export function approval(started: Begun) {
	return { handoffId: started.handoffId, userCode: normalizeCode(started.userCode) };
}

/** Keeps what a call returned, or the AuthFailure it was refused with. */
export async function outcome(
	run: () => Promise<unknown>
): Promise<{ output: unknown } | { error: unknown }> {
	try {
		return { output: await run() };
	} catch (caught) {
		if (!(caught instanceof AuthFailure)) throw caught;
		return {
			error: {
				name: caught.name,
				code: caught.code,
				status: caught.status,
				message: caught.message
			}
		};
	}
}

/** Replaces one-time secrets inside a value, so neither an assertion nor a recorded case holds them. */
export function redact<T>(value: T, secrets: string[]): T {
	const text = secrets.reduce(
		(json, secret) => json.split(secret).join('<redacted>'),
		JSON.stringify(value)
	);
	return JSON.parse(text) as T;
}

/** Records one state's cases; the file is named after the state id, as the examples gate expects. */
export function record(symbol: string, state: string, cases: Case[]) {
	recordExampleCases(
		{
			unitId: 'hub.service.native-handoff',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('start issues a dashed user code and a five minute handoff', async () => {
	const { service, store } = fixture();
	const cases: Case[] = [];
	const secrets: string[] = [];
	expect(HANDOFF_TTL).toBe(300000);
	expect(POLL_INTERVAL).toBe(2);
	for (const [challenge, desktop] of starts) {
		const input = { challenge, nonce: desktop.nonce, resource: desktop.resource };
		const started = await service.start(input);
		const stored = await store.exchanges.find(started.handoffId);
		expect(USER_CODE.test(started.userCode)).toBe(true);
		expect(started.handoffId.length).toBe(43);
		expect(started.verificationUrl === `${ORIGIN}/native/${started.handoffId}`).toBe(true);
		expect(started.expiresAt).toBe(new Date(START + HANDOFF_TTL).toISOString());
		expect(started.interval).toBe(POLL_INTERVAL);
		expect(stored?.challenge).toBe(challenge);
		expect(store.dump().includes(desktop.nonce)).toBe(false);
		expect(store.dump().includes(started.userCode)).toBe(false);
		secrets.push(started.userCode);
		cases.push({ name: `start for ${desktop.resource}`, input, output: started });
	}
	record(
		'start',
		'start-issues-a-dashed-user-code-and-a-five-minute-handoff',
		redact(cases, secrets)
	);
});

test('approve binds the handoff to the approving browser session', async () => {
	const { service, store } = fixture();
	const first = await begin(service, projects);
	const second = await begin(service, project);
	const dashed = { handoffId: second.handoffId, userCode: second.userCode };
	const normalized = await outcome(() => service.approve(approver, approval(first)));
	const refusedDashed = await outcome(() => service.approve(approver, dashed));
	const approvedSecond = await outcome(() => service.approve(approver, approval(second)));
	const repeated = await outcome(() => service.approve(approver, approval(first)));
	expect([normalized, refusedDashed, approvedSecond, repeated]).toEqual([
		{ output: { approved: true, resource: 'projects' } },
		{ error: REFUSED },
		{ output: { approved: true, resource: project.resource } },
		{ error: REFUSED }
	]);
	const stored = await store.exchanges.find(first.handoffId);
	expect(stored?.subject).toBe(approver.actor.id);
	expect(stored?.parentHash).toBe(approver.idHash);
	const cases: Case[] = [
		{
			name: 'the normalized code approves the projects handoff',
			input: approval(first),
			...normalized
		},
		{ name: 'a dashed code never matches the stored hash', input: dashed, ...refusedDashed },
		{
			name: 'the normalized code approves the project handoff',
			input: approval(second),
			...approvedSecond
		},
		{ name: 'an approved handoff cannot be approved again', input: approval(first), ...repeated }
	];
	const codes = [first, second].flatMap((started) => [
		started.userCode,
		normalizeCode(started.userCode)
	]);
	record(
		'approve',
		'approve-binds-the-handoff-to-the-approving-browser-session',
		redact(cases, codes)
	);
});
