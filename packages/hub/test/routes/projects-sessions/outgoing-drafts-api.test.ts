import { createHmac, createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { serveOutgoingDrafts } from '../../../src/routes/(projects-sessions)/api/outgoing-drafts/serveOutgoingDrafts';
import type { OutgoingDraftDeps } from '../../../src/routes/(projects-sessions)/api/outgoing-drafts/serveOutgoingDrafts.types';

const origin = 'https://hub.example.test';
const path = '/api/outgoing-drafts';
const gatewayPath = '/sync/owner/outgoing-drafts';
const key = 'synthetic-key-for-owner-fixture-only';
const now = 1795815000000;
const session = {
	kind: 'browser' as const,
	resource: 'projects',
	actor: {
		id: 'fixture-owner',
		email: 'owner@example.test',
		name: 'Fixture owner',
		emailVerified: true as const
	},
	idHash: 'fixture-hash',
	parentHash: null,
	revokedAt: null,
	createdAt: now,
	expiresAt: now + 1000
};

function fixture() {
	const fetcher = vi.fn<typeof fetch>(async () => Response.json([{ status: 'sent' }]));
	const resolve = vi.fn<NonNullable<OutgoingDraftDeps['sessions']>['resolve']>();
	const deps = {
		ownerId: session.actor.id,
		sessions: { resolve },
		gateway: { origin: 'https://tracker.example.test', key },
		fetcher,
		now
	};
	return { deps, resolve, fetcher };
}

test('only the verified owner with the right resource reaches the outgoing gateway', async () => {
	const { deps, resolve, fetcher } = fixture();
	const request = new Request(origin + path, { headers: { 'X-Tracker-As': 'Daniel' } });
	resolve.mockResolvedValueOnce(null);
	expect(await serveOutgoingDrafts(request, deps)).toMatchObject({ status: 403 });
	resolve.mockResolvedValueOnce({ ...session, actor: { ...session.actor, id: 'other-owner' } });
	expect(await serveOutgoingDrafts(request, deps)).toMatchObject({ status: 403 });
	resolve.mockResolvedValueOnce({ ...session, kind: 'native', resource: 'project:123' });
	expect(await serveOutgoingDrafts(request, deps)).toMatchObject({ status: 403 });
	expect(fetcher).not.toHaveBeenCalled();
});

test('signs the exact proposed revision and keeps the Tracker authorization out of the response', async () => {
	const { deps, resolve, fetcher } = fixture();
	const body = JSON.stringify({
		id: '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c',
		revision: 2,
		action: 'send'
	});
	resolve.mockResolvedValueOnce(session);
	const formPost = new Request(origin + path, {
		method: 'POST',
		body,
		headers: { 'content-type': 'text/plain' }
	});
	expect(await serveOutgoingDrafts(formPost, deps)).toMatchObject({ status: 415 });
	expect(fetcher).not.toHaveBeenCalled();
	resolve.mockResolvedValueOnce({ ...session, kind: 'native' });
	const request = new Request(origin + path, {
		method: 'POST',
		body,
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer synthetic-native-session'
		}
	});
	const response = await serveOutgoingDrafts(request, deps);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual([{ status: 'sent' }]);
	expect(response.headers.get('cache-control')).toBe('private, no-store');
	expect(response.headers.get('authorization')).toBeNull();
	const [target, options] = fetcher.mock.calls[0];
	expect(String(target)).toEqual('https://tracker.example.test' + gatewayPath);
	expect(options).toMatchObject({ method: 'POST', body, redirect: 'error' });
	const hash = createHash('sha256').update(body).digest('hex');
	const signature = createHmac('sha256', key)
		.update(`POST\n${gatewayPath}\n${now}\n${hash}`)
		.digest('hex');
	expect(new Headers(options?.headers).get('authorization')).toBe(
		`TrackerHMAC ts=${now},sig=${signature}`
	);
});
