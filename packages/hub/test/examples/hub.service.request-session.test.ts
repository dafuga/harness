import type { Actor } from 'collaboration';
import { test } from 'vitest';
import { RequestSessionService } from '../../src/lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { memoryAuthStore } from '../support/memoryAuthStore';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Call, Example, Outcome } from './hub.service.request-session.test.types';

const hub = 'https://hub.example.com';
const elsewhere = 'https://evil.example.net';
const NOW = 1794700800000;
const DAY = 24 * 60 * 60 * 1000;
const actor: Actor = {
	id: 'google-11223344556677889900',
	email: 'alex.rivera@example.com',
	name: 'Alex Rivera',
	emailVerified: true
};
const projectA = '/api/projects/prj_example_01/tasks';
const projectB = '/api/projects/prj_example_02/tasks';

function summary(kind: string, resource: string, expiresAt: number) {
	return { kind, resource, actor: actor.id, createdAt: NOW, expiresAt };
}
const browserSummary = summary('browser', 'projects', NOW + 7 * DAY);
const nativeSummary = summary('native', 'project:prj_example_01', NOW + 30 * DAY);

/** A real repository over the in-memory auth store, with a fixed clock and one live session per channel. */
async function fixture() {
	const repository = new SessionRepository({
		store: memoryAuthStore().sessions,
		secrets: authSecrets('request-session-example-secret-0123456789'),
		now: () => NOW
	});
	const grant = (kind: 'browser' | 'native', resource: string) => ({
		kind,
		actor,
		resource,
		parentHash: null
	});
	const browser = await repository.issue(grant('browser', 'projects'));
	const native = await repository.issue(grant('native', 'project:prj_example_01'));
	return {
		service: new RequestSessionService({ sessions: repository, origin: hub }),
		browser: browser.credential,
		native: native.credential
	};
}

function requestFor({ method, path, origin, bearer, cookie }: Call): Request {
	const headers = new Headers();
	if (origin !== null) headers.set('origin', origin);
	if (bearer !== undefined) headers.set('authorization', `Bearer ${bearer}`);
	if (cookie !== undefined) headers.set('cookie', `__Host-harness_session=${cookie}`);
	return new Request(`${hub}${path}`, { method, headers });
}

function inputOf({ method, path, origin, bearer, cookie }: Call) {
	const channels = [bearer !== undefined && 'bearer', cookie !== undefined && 'cookie'];
	const credential = channels.filter(Boolean).join('+') || 'none';
	return { method, path, origin, credential };
}

function summaryOf(session: SessionRecord | null) {
	if (session === null) return null;
	const { kind, resource, createdAt, expiresAt } = session;
	return { kind, resource, actor: session.actor.id, createdAt, expiresAt };
}

/** Runs each example through the real operation, asserts it, and keeps what was observed. */
async function observe(examples: Example[], operate: (request: Request) => Promise<unknown>) {
	const observed: Array<{ name: string; input: ReturnType<typeof inputOf> } & Outcome> = [];
	for (const { name, call, expected } of examples) {
		let outcome: Outcome;
		try {
			outcome = { output: await operate(requestFor(call)) };
		} catch (error) {
			if (!(error instanceof AuthFailure)) throw error;
			outcome = { error: error.code };
		}
		expect(outcome).toEqual(expected);
		observed.push({ name, input: inputOf(call), ...outcome });
	}
	return observed;
}

const unit = { unitId: 'hub.service.request-session', evidence: 'examples-cases' };

function record(symbol: string, state: string, observed: Awaited<ReturnType<typeof observe>>) {
	recordExampleCases({ ...unit, symbol, state, file: `${state}.json` }, observed);
}

test('resolves a live session on its own channel and scope', async () => {
	const { service, browser, native } = await fixture();
	const examples: Example[] = [
		{
			name: 'native bearer reaches its own project',
			call: { method: 'GET', path: projectA, origin: null, bearer: native },
			expected: { output: nativeSummary }
		},
		{
			name: 'native bearer is refused on another project',
			call: { method: 'GET', path: projectB, origin: null, bearer: native },
			expected: { output: null }
		},
		{
			name: 'browser cookie reaches the projects resource',
			call: { method: 'GET', path: projectB, origin: null, cookie: browser },
			expected: { output: browserSummary }
		},
		{
			name: 'bearer carrying a browser credential never falls back to the cookie',
			call: { method: 'GET', path: projectA, origin: null, bearer: browser, cookie: browser },
			expected: { output: null }
		}
	];
	const observed = await observe(examples, (request) => service.resolve(request).then(summaryOf));
	record('resolve', 'resolves-a-live-session-on-its-own-channel-and-scope', observed);
});

test('browser resolves the cookie session and rejects bearer', async () => {
	const { service, browser, native } = await fixture();
	const examples: Example[] = [
		{
			name: 'cookie GET reaches the projects resource',
			call: { method: 'GET', path: projectA, origin: null, cookie: browser },
			expected: { output: browserSummary }
		},
		{
			name: 'same-origin unsafe cookie request is accepted',
			call: { method: 'POST', path: projectA, origin: hub, cookie: browser },
			expected: { output: browserSummary }
		},
		{
			name: 'cross-origin unsafe cookie request is denied',
			call: { method: 'POST', path: projectA, origin: elsewhere, cookie: browser },
			expected: { error: 'origin-denied' }
		},
		{
			name: 'an Authorization header is rejected even beside a live cookie',
			call: { method: 'GET', path: projectA, origin: null, bearer: native, cookie: browser },
			expected: { error: 'session-required' }
		}
	];
	const observed = await observe(examples, (request) => service.browser(request).then(summaryOf));
	record('browser', 'browser-resolves-the-cookie-session-and-rejects-bearer', observed);
});

test('required resolves an in-scope session or throws', async () => {
	const { service, browser, native } = await fixture();
	const examples: Example[] = [
		{
			name: 'native bearer in scope is accepted',
			call: { method: 'GET', path: projectA, origin: null, bearer: native },
			expected: { output: nativeSummary }
		},
		{
			name: 'browser cookie in scope is accepted',
			call: { method: 'GET', path: projectB, origin: null, cookie: browser },
			expected: { output: browserSummary }
		},
		{
			name: 'native bearer out of scope is session-required',
			call: { method: 'GET', path: projectB, origin: null, bearer: native },
			expected: { error: 'session-required' }
		},
		{
			name: 'cross-origin unsafe cookie request is origin-denied',
			call: { method: 'POST', path: projectA, origin: elsewhere, cookie: browser },
			expected: { error: 'origin-denied' }
		}
	];
	const observed = await observe(examples, (request) => service.required(request).then(summaryOf));
	record('required', 'required-resolves-an-in-scope-session-or-throws', observed);
});

test('crossOrigin flags unsafe methods from another origin', async () => {
	const { service } = await fixture();
	const examples: Example[] = [
		{
			name: 'GET from another origin is safe',
			call: { method: 'GET', path: projectA, origin: elsewhere },
			expected: { output: false }
		},
		{
			name: 'POST from the public origin is same-origin',
			call: { method: 'POST', path: projectA, origin: hub },
			expected: { output: false }
		},
		{
			name: 'POST from another origin is cross-origin',
			call: { method: 'POST', path: projectA, origin: elsewhere },
			expected: { output: true }
		},
		{
			name: 'POST without an Origin header counts as cross-origin',
			call: { method: 'POST', path: projectA, origin: null },
			expected: { output: true }
		}
	];
	const observed = await observe(examples, (request) =>
		Promise.resolve(service.crossOrigin(request))
	);
	record('crossOrigin', 'crossorigin-flags-unsafe-methods-from-another-origin', observed);
});
