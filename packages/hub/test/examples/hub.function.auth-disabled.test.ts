import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { authDisabled } from '../../src/lib/verification-evidence/server/auth/authDisabled';

const state = 'disabled-authentication-reports-status-and-refuses-protected';

async function responseSummary(response: Response | null) {
	if (response === null) return null;
	const body = (await response.json()) as { configured?: boolean; error?: string };
	return { status: response.status, configured: body.configured ?? null, code: body.error ?? null };
}

async function failureSummary(operation: () => Promise<unknown>) {
	try {
		await operation();
		return null;
	} catch (error) {
		const failure = error as { code?: string; status?: number; message?: string };
		return {
			code: failure.code ?? null,
			status: failure.status ?? null,
			message: failure.message ?? null
		};
	}
}

test('Disabled authentication reports status and refuses protected', async () => {
	const auth = authDisabled();
	const authStatus = await responseSummary(
		await auth.handle(new Request('https://hub.test/api/auth/status'))
	);
	const githubStatus = await responseSummary(
		await auth.handle(new Request('https://hub.test/api/github/status'))
	);
	const refusedRoute = await responseSummary(
		await auth.handle(new Request('https://hub.test/api/auth/session'))
	);
	const unrelatedRoute = await auth.handle(new Request('https://hub.test/health'));
	const actor = await auth.actor(new Request('https://hub.test/api/auth/status'));
	const authorizeFailure = await failureSummary(() => auth.authorizeRepository({} as never, 42));
	const tokenFailure = await failureSummary(() => auth.token({} as never));
	const cases = [
		{
			name: 'auth status is unconfigured',
			input: { method: 'GET', path: '/api/auth/status' },
			output: authStatus
		},
		{
			name: 'GitHub status is unconfigured',
			input: { method: 'GET', path: '/api/github/status' },
			output: githubStatus
		},
		{
			name: 'other auth routes are refused',
			input: { method: 'GET', path: '/api/auth/session' },
			output: refusedRoute
		},
		{
			name: 'outside auth prefixes is unhandled',
			input: { path: '/health' },
			output: await responseSummary(unrelatedRoute)
		},
		{ name: 'no actor is issued', input: { operation: 'actor' }, output: actor },
		{
			name: 'repository authorization is refused',
			input: { repositoryId: 42 },
			output: authorizeFailure
		},
		{ name: 'installation token is refused', input: {}, output: tokenFailure }
	];
	expect(authStatus).toEqual({ status: 200, configured: false, code: null });
	expect(githubStatus).toEqual({ status: 200, configured: false, code: null });
	expect(refusedRoute).toEqual({ status: 503, configured: null, code: 'auth-disabled' });
	expect(unrelatedRoute).toBeNull();
	expect(actor).toBeNull();
	expect(authorizeFailure).toEqual({
		code: 'github-disabled',
		status: 503,
		message: 'Hub auth github-disabled'
	});
	expect(tokenFailure).toEqual({
		code: 'github-disabled',
		status: 503,
		message: 'Hub auth github-disabled'
	});
	recordExampleCases(
		{
			unitId: 'hub.function.auth-disabled',
			symbol: 'authDisabled',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
});
