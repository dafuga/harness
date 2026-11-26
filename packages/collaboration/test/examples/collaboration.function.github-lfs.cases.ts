import { test } from 'vitest';
import { githubLfs } from '../../src/utils/git-source-history/create-git-hub-source/githubLfs';
import type { GitHubOptions } from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Reply, Sent, Observed } from './collaboration.function.github-lfs.test.types';

/**
 * The real githubLfs, called as its caller calls it, with a scripted fetch that answers the batch
 * request, then the download, in order. Nothing leaves the test; each state's calls are recorded.
 */
const unitId = 'collaboration.function.github-lfs';
const repository = { id: 202, owner: 'acme', name: 'pilot', private: true, installationId: 7 };
export const installationToken = 'example-installation-token';

export const encode = (value: string) => new TextEncoder().encode(value);
const shown = (bytes: Uint8Array) => ({
	length: bytes.length,
	text: new TextDecoder().decode(bytes)
});

/** A request as the fake received it: method, URL, redirect mode, headers and any JSON body. */
export function sentOf(url: string, init: RequestInit = {}) {
	return {
		method: init.method ?? 'GET',
		url,
		redirect: init.redirect ?? 'follow',
		headers: (init.headers as Record<string, string> | undefined) ?? null,
		body: typeof init.body === 'string' ? JSON.parse(init.body) : null
	};
}

/**
 * Answers each request with the next scripted reply and keeps every request that was sent. A request
 * past the script gets a 599, so the recorded requests show it and the code reports it as unavailable.
 */
function scripted(server: Reply[]) {
	const requests: Sent[] = [];
	const answer = async (input: RequestInfo | URL, init?: RequestInit) => {
		requests.push(sentOf(String(input), init));
		const { status, json, text, headers }: Reply = server[requests.length - 1] ?? { status: 599 };
		return json === undefined
			? new Response(text ?? '', { status, headers })
			: new Response(JSON.stringify(json), {
					status,
					headers: { 'content-type': 'application/json' }
				});
	};
	return { answer, requests };
}

/** One call as its caller makes it: the bytes or the refusal code that came back, and what was sent. */
export async function run(blob: Uint8Array, server: Reply[], tokenFails: boolean) {
	const transport = scripted(server);
	const tokens: unknown[] = [];
	const base: Omit<GitHubOptions, 'repository'> = {
		token: async (scope) => {
			tokens.push(scope);
			if (tokenFails) throw new Error('token service unavailable');
			return installationToken;
		},
		fetch: transport.answer
	};
	try {
		const value = await githubLfs({ ...base, repository }, blob);
		return { value, code: undefined, requests: transport.requests, tokens };
	} catch (error) {
		if (!(error instanceof Error && 'code' in error)) throw error;
		return { value: undefined, code: String(error.code), requests: transport.requests, tokens };
	}
}

/** One call: the outcome the test asserts on, and the case that records it as evidence. */
export async function observe(
	name: string,
	blob: Uint8Array,
	server: Reply[] = [],
	tokenFails = false
) {
	const outcome = await run(blob, server, tokenFails);
	const token = tokenFails ? 'refuses to issue a token' : 'issues a contents-read token';
	const input = { repository, blob: shown(blob), server, token };
	const trace = { requests: outcome.requests, tokens: outcome.tokens };
	const recorded =
		outcome.value === undefined
			? { name, input, error: { code: outcome.code, ...trace } }
			: { name, input, output: { bytes: shown(outcome.value), ...trace } };
	return { outcome, recorded };
}

/** Records one state's calls as its cases, under the unit and the function they show. */
export const record = (state: string, calls: Observed[]) =>
	recordExampleCases(
		{ unitId, symbol: 'githubLfs', state, evidence: 'examples-cases', file: `${state}.json` },
		calls.map(({ recorded }) => recorded)
	);

test('Returns bytes that are not an LFS pointer unchanged', async () => {
	const readme = encode('# Notes\nSee the design doc.\n');
	const image = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff);
	const mention = encode('Read https://git-lfs.github.com/spec/v1 for the format.\n');
	const calls = [
		await observe('plain text is returned unchanged', readme),
		await observe('binary bytes are returned unchanged', image),
		await observe('text that mentions the spec is unchanged', mention)
	];
	record('returns-bytes-that-are-not-an-lfs-pointer-unchanged', calls);
	expect(calls[0].outcome.value).toBe(readme);
	expect(calls[1].outcome.value).toBe(image);
	expect(calls[2].outcome.value).toBe(mention);
	expect(calls.map(({ outcome }) => outcome.requests.length)).toEqual([0, 0, 0]);
});
