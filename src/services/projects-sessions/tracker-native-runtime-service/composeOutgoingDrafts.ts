// @harness-uid u_bl6xl2h4a3
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerOutgoingDraftService } from '../TrackerOutgoingDraftService';
import { TrackerSyncAuthService } from '../../networking-security/TrackerSyncAuthService';
import { readItemBody } from '../tracker-local-api-service/trackerLocalItemMutation';
import { trackerFailureResponse } from '../tracker-local-api-service/trackerLocalResponse';
import {
	outgoingDraftAgentApi,
	outgoingDraftBodyLimit,
	outgoingDraftSyncPath
} from '../tracker-outgoing-draft-service/outgoingDraftAgentApi';

export function composeOutgoingDrafts(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const service =
		options.role === 'hub'
			? new TrackerOutgoingDraftService(store, {
					now: options.now,
					provider: options.outgoingProvider
				})
			: undefined;
	const link = options.links?.find(({ link }) => (link ?? 'hub') === 'hub');
	const route = async (request: Request) => {
		const url = new URL(request.url);
		if (url.search || (request.method !== 'GET' && request.method !== 'POST'))
			return Response.json({ error: 'unsupported draft request' }, { status: 405 });
		try {
			const body =
				request.method === 'POST' ? await readItemBody(request, outgoingDraftBodyLimit) : undefined;
			request.signal.throwIfAborted();
			return service
				? outgoingDraftAgentApi(service, request.method, body, store.node)
				: await relayDraftRequest(store, request, { link, body });
		} catch (error) {
			return trackerFailureResponse(error);
		}
	};
	return { service, route };
}

async function relayDraftRequest(
	store: TrackerPersistenceService,
	request: Request,
	{
		link,
		body
	}: { link?: NonNullable<TrackerNativeRuntimeOptions['links']>[number]; body?: object }
) {
	if (!link) return Response.json({ error: 'draft hub unavailable' }, { status: 503 });
	const outgoing = {
		method: body === undefined ? ('GET' as const) : ('POST' as const),
		pathAndQuery: outgoingDraftSyncPath,
		body: body === undefined ? undefined : JSON.stringify(body)
	};
	const auth = new TrackerSyncAuthService(link.secret);
	const data = await link.transport(
		{
			...outgoing,
			headers: {
				authorization: auth.authorizationHeader(outgoing),
				'content-type': 'application/json',
				'x-tracker-node': store.node
			},
			timeoutMs: 6000
		},
		request.signal
	);
	return Response.json(data, {
		status: body === undefined ? 200 : 201,
		headers: { 'cache-control': 'private, no-store' }
	});
}
