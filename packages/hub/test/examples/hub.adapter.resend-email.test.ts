import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	ResendEmailAdapter,
	createResendDelivery
} from '../../src/lib/verification-evidence/server/auth/ResendEmailAdapter';
import type { ResendEmailAdapterConfig } from '../../src/lib/verification-evidence/server/auth/ResendEmailAdapter.types';
import type { Respond, Call } from './hub.adapter.resend-email.test.types';

const UNIT = 'hub.adapter.resend-email';
const API_KEY = 'ExampleKey_0123456789abcdef';
const FROM = 'Harness <auth@example.com>';
const MESSAGE = {
	email: 'reviewer@example.com',
	code: '04829173',
	expiresAt: '2026-11-15T14:10:00.000Z'
};

/** A fake fetch that records each call and answers with `respond`. The network is never used. */
function recording(respond: Respond) {
	const calls: Call[] = [];
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return respond();
	}) as typeof fetch;
	return { calls, fetcher };
}

function reply(status: number, body: string | null = null): Respond {
	return () => new Response(body, { status });
}

function adapterWith(respond: Respond) {
	const { calls, fetcher } = recording(respond);
	const config: ResendEmailAdapterConfig = { apiKey: API_KEY, from: FROM, fetch: fetcher };
	return { adapter: new ResendEmailAdapter(config), calls };
}

/** The posted request without the bearer token, with the JSON body parsed back. */
function postedRequest(call: Call) {
	return {
		url: call.url,
		method: call.init.method,
		redirect: call.init.redirect,
		body: JSON.parse(String(call.init.body)) as {
			from: string;
			to: string[];
			subject: string;
			text: string;
		}
	};
}

async function failureOf(respond: Respond): Promise<unknown> {
	const { adapter } = adapterWith(respond);
	return adapter.send(MESSAGE).then(
		() => undefined,
		(error: unknown) => error
	);
}

function errorCode(error: unknown) {
	return { code: (error as { code?: unknown }).code };
}

const FAILURES = [
	{ name: 'status 500 with provider text', respond: reply(500, 'provider detail') },
	{ name: 'redirect 302 is not followed', respond: reply(302) },
	{ name: '2xx with a numeric id', respond: reply(200, '{"id":5}') },
	{ name: '2xx with a body that is not JSON', respond: reply(200, 'accepted') },
	{
		name: 'fetch throws',
		respond: (): Response => {
			throw new Error('network unavailable');
		}
	}
];

const VALID_ENVS = [
	{ HARNESS_EMAIL_API_KEY: API_KEY, HARNESS_EMAIL_FROM: 'Harness <auth@example.com>' },
	{ HARNESS_EMAIL_API_KEY: API_KEY, HARNESS_EMAIL_FROM: 'auth@example.com' }
];

const INVALID_ENVS = [
	{},
	{ HARNESS_EMAIL_API_KEY: 'short', HARNESS_EMAIL_FROM: 'auth@example.com' },
	{ HARNESS_EMAIL_API_KEY: API_KEY, HARNESS_EMAIL_FROM: 'Harness auth@example.com' }
];

test('send resolves when Resend accepts the message', async () => {
	const { adapter, calls } = adapterWith(reply(200, JSON.stringify({ id: 're_example_1' })));
	const output = await adapter.send(MESSAGE);
	expect(output).toBeUndefined();
	expect(calls).toHaveLength(1);
	const request = postedRequest(calls[0]);
	expect(request.url).toBe('https://api.resend.com/emails');
	expect(request.method).toBe('POST');
	expect(request.redirect).toBe('manual');
	expect(calls[0].init.headers).toEqual({
		Authorization: `Bearer ${API_KEY}`,
		'Content-Type': 'application/json'
	});
	expect(request.body.to).toEqual(['reviewer@example.com']);
	expect(request.body.from).toBe(FROM);
	expect(request.body.text).toContain('Your Harness verification code is 04829173.');
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'ResendEmailAdapter.send',
			state: 'send-resolves-when-resend-accepts-the-message',
			evidence: 'examples-cases',
			file: 'send-resolves-when-resend-accepts-the-message.json'
		},
		[
			{
				name: 'reviewer message is posted once and resolves',
				input: MESSAGE,
				output: { resolved: true, request }
			}
		]
	);
});

test('send rejects with email-delivery-failed on any failure', async () => {
	const errors = await Promise.all(FAILURES.map((failure) => failureOf(failure.respond)));
	expect(errors).toHaveLength(FAILURES.length);
	errors.forEach((error) => {
		expect(error).toMatchObject({ code: 'email-delivery-failed' });
	});
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'ResendEmailAdapter.send',
			state: 'send-rejects-with-email-delivery-failed-on-any-failure',
			evidence: 'examples-cases',
			file: 'send-rejects-with-email-delivery-failed-on-any-failure.json'
		},
		FAILURES.map((failure, index) => ({
			name: failure.name,
			input: { message: MESSAGE, outcome: failure.name },
			error: errorCode(errors[index])
		}))
	);
});

test('createResendDelivery returns an adapter for valid settings', () => {
	const { fetcher } = recording(reply(200));
	const deliveries = VALID_ENVS.map((env) => createResendDelivery(env, fetcher));
	deliveries.forEach((delivery) => {
		expect(delivery).toBeInstanceOf(ResendEmailAdapter);
	});
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'createResendDelivery',
			state: 'createresenddelivery-returns-an-adapter-for-valid-settings',
			evidence: 'examples-cases',
			file: 'createresenddelivery-returns-an-adapter-for-valid-settings.json'
		},
		VALID_ENVS.map((env, index) => ({
			name: `sender ${env.HARNESS_EMAIL_FROM} is accepted`,
			input: env,
			output: { isAdapter: deliveries[index] instanceof ResendEmailAdapter }
		}))
	);
});

test('createResendDelivery returns null for malformed settings', () => {
	const { fetcher } = recording(reply(200));
	const deliveries = INVALID_ENVS.map((env) => createResendDelivery(env, fetcher));
	deliveries.forEach((delivery) => {
		expect(delivery).toBeNull();
	});
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'createResendDelivery',
			state: 'createresenddelivery-returns-null-for-malformed-settings',
			evidence: 'examples-cases',
			file: 'createresenddelivery-returns-null-for-malformed-settings.json'
		},
		INVALID_ENVS.map((env, index) => ({
			name: `settings ${index + 1} disable delivery`,
			input: env,
			output: deliveries[index]
		}))
	);
});
