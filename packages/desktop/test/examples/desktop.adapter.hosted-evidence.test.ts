import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedEvidenceAdapter } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hosted-evidence-adapter/HostedEvidenceAdapter';
import type { Query } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hosted-evidence-adapter/HostedEvidenceAdapter.types';

const query: Query = {
	projectId: 'buildflexity-app',
	entityId: 'reports.component.evidence-grid',
	commit: '0123456789abcdef0123456789abcdef01234567',
	branch: 'main',
	mode: 'commit'
};

function adapterWithEvidence(body: string): HostedEvidenceAdapter {
	const origin = 'https://hosted.example';
	const fetcher = async (input: RequestInfo | URL) => {
		const url = String(input);
		return url.endsWith('/api/auth/status')
			? Response.json({ actor: { id: 'example-user', emailVerified: true } })
			: new Response(body, { headers: { 'content-type': 'application/json' } });
	};
	return new HostedEvidenceAdapter({
		origin,
		credentials: async () => ({ origin, principalId: 'example-user', token: 'example-token' }),
		fetch: fetcher as typeof fetch
	});
}

test('builds-hosted-evidence-path', () => {
	const adapter = adapterWithEvidence('{}');
	const output = adapter.path('evidence', query);
	expect(output).toContain('/api/projects/buildflexity-app/evidence?');
	const cases = [{ name: 'evidence path', input: { operation: 'evidence', query }, output }];
	recordExampleCases({
		unitId: 'desktop.adapter.hosted-evidence',
		symbol: 'path',
		state: 'builds-hosted-evidence-path',
		evidence: 'examples-cases',
		file: 'builds-hosted-evidence-path.json'
	}, cases);
});

test('reads-hosted-evidence-json', async () => {
	const input = { ...query };
	const output = await adapterWithEvidence('{"evidence":{"count":2}}').evidence(input);
	expect(output).toEqual({ evidence: { count: 2 } });
	const cases = [{ name: 'JSON evidence response', input, output }];
	recordExampleCases({
		unitId: 'desktop.adapter.hosted-evidence',
		symbol: 'evidence',
		state: 'reads-hosted-evidence-json',
		evidence: 'examples-cases',
		file: 'reads-hosted-evidence-json.json'
	}, cases);
});

test('throws Error for invalid evidence JSON', async () => {
	const input = { ...query };
	const adapter = adapterWithEvidence('not-json');
	await expect(adapter.evidence(input)).rejects.toThrow(
		'This app does not accept the hosted evidence answer.'
	);
	const cases = [{
		name: 'invalid hosted evidence JSON',
		input,
		error: { name: 'InvalidHostedEvidenceAnswerError', message: 'This app does not accept the hosted evidence answer.' }
	}];
	recordExampleCases({
		unitId: 'desktop.adapter.hosted-evidence',
		symbol: 'evidence',
		state: 'throws-error-for-invalid-evidence-json',
		evidence: 'examples-cases',
		file: 'throws-error-for-invalid-evidence-json.json'
	}, cases);
});

test('throws HostedFailureValidator for rejected hosted request', async () => {
	const origin = 'https://hosted.example';
	const fetcher = async (input: RequestInfo | URL) => String(input).endsWith('/api/auth/status')
		? Response.json({ actor: { id: 'example-user', emailVerified: true } })
		: new Response('unavailable', { status: 503 });
	const adapter = new HostedEvidenceAdapter({
		origin,
		credentials: async () => ({ origin, principalId: 'example-user', token: 'example-token' }),
		fetch: fetcher as typeof fetch
	});
	const input = { ...query };
	await expect(adapter.evidence(input)).rejects.toMatchObject({ category: 'failed' });
	const cases = [{ name: 'hosted service unavailable', input, error: { name: 'HostedFailureValidator', category: 'failed' } }];
	recordExampleCases({
		unitId: 'desktop.adapter.hosted-evidence',
		symbol: 'evidence',
		state: 'throws-hostedfailurevalidator-for-rejected-hosted-request',
		evidence: 'examples-cases',
		file: 'throws-hostedfailurevalidator-for-rejected-hosted-request.json'
	}, cases);
});

test('throws TypeError for malformed origin URL', () => {
	const input = { origin: '://invalid', credentials: async () => null };
	expect(() => new HostedEvidenceAdapter(input)).toThrow(TypeError);
	const cases = [{ name: 'malformed origin', input: { origin: input.origin }, error: { name: 'TypeError' } }];
	recordExampleCases({
		unitId: 'desktop.adapter.hosted-evidence',
		symbol: 'constructor',
		state: 'throws-typeerror-for-malformed-origin-url',
		evidence: 'examples-cases',
		file: 'throws-typeerror-for-malformed-origin-url.json'
	}, cases);
});
