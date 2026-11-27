import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GithubApiAdapter } from '../../src/lib/verification-evidence/server/auth/GithubApiAdapter';
import type { GithubApiOptions } from '../../src/lib/verification-evidence/server/auth/GithubApiAdapter.types';

export function adapterFor(
	body: unknown,
	status = 200
): { adapter: GithubApiAdapter; calls: Array<{ url: string; init: RequestInit }> } {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const options: GithubApiOptions = {
		fetch: async (input, init = {}) => {
			calls.push({ url: String(input), init });
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	};
	return { adapter: new GithubApiAdapter(options), calls };
}

test('userToken exchanges an authorization code', async () => {
	const { adapter, calls } = adapterFor({
		access_token: 'gho_Qx7Lm2Rt9Vb4Nc8Zp1Wk6Hs3Yj5Df0Ga',
		token_type: 'bearer',
		expires_in: 28800
	});
	const form = {
		client_id: 'Iv1.5c2e8a9b0d7f4e13',
		client_secret: '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e',
		code: '3d8f1a9c2e7b5046'
	};
	const output = await adapter.userToken(form);
	expect(output).toEqual({
		accessToken: 'gho_Qx7Lm2Rt9Vb4Nc8Zp1Wk6Hs3Yj5Df0Ga',
		expiresIn: 28800,
		refreshToken: null,
		refreshExpiresIn: null
	});
	expect(calls[0]?.init.redirect).toBe('manual');
	recordExampleCases(
		{
			unitId: 'hub.adapter.github-api',
			symbol: 'GithubApiAdapter.userToken',
			state: 'usertoken-exchanges-an-authorization-code',
			evidence: 'examples-cases',
			file: 'usertoken-exchanges-an-authorization-code.json'
		},
		[
			{
				name: 'valid code returns a normalized user token',
				input: {
					form,
					endpoint: calls[0]?.url,
					method: calls[0]?.init.method,
					body: calls[0]?.init.body
				},
				output
			}
		]
	);
});
