import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GithubConnectionController } from '../../src/lib/verification-evidence/server/auth/github-connection-controller/GithubConnectionController';
import type {
	GithubConnection,
	GithubConnectionControllerOptions
} from '../../src/lib/verification-evidence/server/auth/github-connection-controller/GithubConnectionController.types';

const actor = { id: 'actor-example' };
const session = { idHash: 'session-example', actor };

function controller(): GithubConnectionController {
	const sessions = {
		required: async () => ({ actor }),
		browser: async () => session
	};
	const github: GithubConnection = {
		grants: {
			status: async () => ({ configured: true, connected: true, login: 'octocat' }),
			begin: async () => 'https://github.com/login/oauth/authorize?state=example',
			complete: async () => undefined,
			disconnect: async () => undefined
		} as unknown as GithubConnection['grants'],
		owner: {
			repositories: async () => ({
				repositories: [{ id: 7, owner: 'octo', name: 'demo', private: true }],
				truncated: false
			})
		} as unknown as GithubConnection['owner']
	};
	const options = {
		origin: 'https://hub.example',
		sessions,
		github
	} as unknown as GithubConnectionControllerOptions;
	return new GithubConnectionController(options);
}

async function capture(
	response: Response
): Promise<{ status: number; location: string | null; body: unknown }> {
	const body = await response.json().catch(() => null);
	return { status: response.status, location: response.headers.get('location'), body };
}

test('Reports the connected GitHub status', async () => {
	const routes = controller().routes();
	const response = await routes['GET /api/github/status'](
		new Request('https://hub.example/api/github/status')
	);
	const output = await capture(response);
	expect(output.body).toEqual({ configured: true, connected: true, login: 'octocat' });
	recordExampleCases(
		{
			unitId: 'hub.controller.github-connection',
			symbol: 'routes',
			state: 'reports-the-connected-github-status',
			evidence: 'examples-cases',
			file: 'reports-the-connected-github-status.json'
		},
		[
			{
				name: 'signed-in actor receives the configured connection status',
				input: { method: 'GET', path: '/api/github/status' },
				output
			}
		]
	);
});

test('Completes GitHub callback at the fixed connected page', async () => {
	const routes = controller().routes();
	const state = 'state-example-0123456789abcdefghij';
	const request = new Request(
		`https://hub.example/api/github/callback?code=code-example&state=${state}`
	);
	const output = await capture(await routes['GET /api/github/callback'](request));
	expect(output.location).toBe('https://hub.example/projects?github=connected');
	recordExampleCases(
		{
			unitId: 'hub.controller.github-connection',
			symbol: 'routes',
			state: 'completes-github-callback-at-the-fixed-connected-page',
			evidence: 'examples-cases',
			file: 'completes-github-callback-at-the-fixed-connected-page.json'
		},
		[
			{
				name: 'valid callback input completes and redirects without exposing credentials',
				input: {
					method: 'GET',
					path: '/api/github/callback',
					query: { code: 'code-example', state }
				},
				output
			}
		]
	);
});
