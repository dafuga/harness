import {
	featureDeliveryApi,
	featureDeliveryDigest,
	featureDeliveryId,
	featureDeliveryProject
} from '../../../../../../../src/utils/projects-sessions/featureDelivery';
import type { DeliveryDeps } from './deliveryPolicy.types';
import { deliveryFeed } from './deliveryFeed';
import { deliveryMedia } from './deliveryMedia';

export async function serveFeatureDeliveries(
	request: Request,
	deps: DeliveryDeps
): Promise<Response> {
	let response: Response;
	try {
		response = await dispatch(request, deps);
	} catch {
		response = Response.json({ error: 'unavailable' }, { status: 503 });
	}
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	return response;
}

async function dispatch(request: Request, { ownerId, sessions, bucket }: DeliveryDeps) {
	const url = new URL(request.url);
	if (!ownerId || url.pathname !== featureDeliveryApi) return new Response(null, { status: 404 });
	const session = await sessions?.resolve(request);
	if (!session) return new Response(null, { status: 401 });
	if (session.actor.id !== ownerId) return new Response(null, { status: 403 });
	if (request.method !== 'GET' && request.method !== 'HEAD')
		return new Response(null, { status: 405 });
	if (url.searchParams.has('project')) return projectResponse(url.searchParams, bucket);
	return mediaResponse(request, url.searchParams, bucket);
}

async function projectResponse(params: URLSearchParams, bucket: R2Bucket | undefined) {
	const project = featureDeliveryProject.safeParse(params.get('project'));
	const cursor = params.get('cursor') ?? undefined;
	if (
		!project.success ||
		(cursor?.length ?? 0) > 4096 ||
		params.size !== (cursor === undefined ? 1 : 2)
	)
		return new Response(null, { status: 400 });
	if (!bucket) return Response.json({ error: 'unavailable' }, { status: 503 });
	return Response.json(await deliveryFeed(bucket, project.data, cursor));
}

async function mediaResponse(
	request: Request,
	params: URLSearchParams,
	bucket: R2Bucket | undefined
) {
	const id = featureDeliveryId.safeParse(params.get('item'));
	const sha = featureDeliveryDigest.safeParse(params.get('sha'));
	if (params.size !== 2 || !id.success || !sha.success) return new Response(null, { status: 400 });
	if (!bucket) return new Response(null, { status: 404 });
	return deliveryMedia(request, bucket, id.data, sha.data);
}
