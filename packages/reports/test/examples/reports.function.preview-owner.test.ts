import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { InvalidPreviewOwnerAddressError } from '../../src/services/accounts-access/preview-server-service/InvalidPreviewOwnerAddressError';
import { PreviewOwnerIdentityMismatchError } from '../../src/services/accounts-access/preview-server-service/PreviewOwnerIdentityMismatchError';
import { PreviewOwnerPortOccupiedError } from '../../src/services/accounts-access/preview-server-service/PreviewOwnerPortOccupiedError';
import { previewOwner } from '../../src/services/accounts-access/preview-server-service/previewOwner';
import { previewOwnerPort } from '../../src/utils/accounts-access/previewOwner';
import type { PreviewOwner } from '../../src/utils/accounts-access/previewOwner.types';

type Case = Parameters<typeof recordExampleCases>[1][number];
type Outcome = { value?: string; error?: Error };

const identity = '9f2c4e7a1b8d03f56e2a9c71d4b8e0f3a6c5d2b1e9f8a7c6d5b4e3f2a1c0d9e8';
const otherIdentity = '3c7e1a9b5d2f80e4a6c3b7d1f5e9a2c8b4d6f0e3a7c1b9d5f2e8a4c6b0d3f7e1';
const runningOwner: PreviewOwner = {
	protocol: 'harness-preview-v1',
	identity,
	url: 'http://127.0.0.1:5688',
	pid: 4242
};

/** Replaces global fetch with a canned loopback reply; the returned function restores it. */
function stubFetch(reply: object): () => void {
	const original = globalThis.fetch;
	const body = JSON.stringify(reply);
	const canned = async (): Promise<Response> => new Response(body, { status: 200 });
	globalThis.fetch = canned as unknown as typeof fetch;
	return () => {
		globalThis.fetch = original;
	};
}

/** Runs the real previewOwner probe against the canned reply and captures its outcome. */
async function outcome(reply: object, requested: string): Promise<Outcome> {
	const restore = stubFetch(reply);
	try {
		return { value: await previewOwner(previewOwnerPort, requested) };
	} catch (error) {
		return { error: error as Error };
	} finally {
		restore();
	}
}

function caseOf(name: string, input: object, result: Outcome): Case {
	if (result.error)
		return {
			name,
			input,
			error: { name: result.error.name, message: result.error.message }
		};
	return { name, input, output: result.value };
}

function record(state: string, cases: Case[]): void {
	recordExampleCases(
		{
			unitId: 'reports.function.preview-owner',
			symbol: 'previewOwner',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Returns the reported preview url for the same identity', async () => {
	const result = await outcome(runningOwner, identity);
	expect(result).toEqual({ value: 'http://127.0.0.1:5688' });
	record('returns-the-reported-preview-url-for-the-same-identity', [
		caseOf('same checkout and history reuse the running preview', { requested: identity, reply: runningOwner }, result)
	]);
});

test('Refuses a preview started from a different checkout', async () => {
	const reply = { ...runningOwner, identity: otherIdentity };
	const result = await outcome(reply, identity);
	expect(result.error).toBeInstanceOf(PreviewOwnerIdentityMismatchError);
	expect(result.error?.message).toBe(
		'A different Harness preview is already running at http://127.0.0.1:5688. Close it before switching checkout or history data.'
	);
	record('refuses-a-preview-started-from-a-different-checkout', [
		caseOf('running preview has another checkout identity', { requested: identity, reply }, result)
	]);
});

test('Refuses a port answered by another application', async () => {
	const reply = { ...runningOwner, protocol: 'other-app' };
	const result = await outcome(reply, identity);
	expect(result.error).toBeInstanceOf(PreviewOwnerPortOccupiedError);
	expect(result.error?.message).toBe(
		'Preview ownership port is occupied by another application.'
	);
	record('refuses-a-port-answered-by-another-application', [
		caseOf('reply has an unknown protocol', { requested: identity, reply }, result)
	]);
});

test('Refuses a reported address that is not loopback', async () => {
	const reply = { ...runningOwner, url: 'http://localhost:5688' };
	const result = await outcome(reply, identity);
	expect(result.error).toBeInstanceOf(InvalidPreviewOwnerAddressError);
	expect(result.error?.message).toBe('Invalid preview owner address.');
	record('refuses-a-reported-address-that-is-not-loopback', [
		caseOf('reported url uses a host name instead of 127.0.0.1', { requested: identity, reply }, result)
	]);
});
