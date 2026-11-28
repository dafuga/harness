import { featureDeliveryVideoKey } from '../../../../../../../src/utils/projects-sessions/featureDelivery';
import { deliveryRange } from './deliveryRange';

export async function deliveryMedia(
	request: Request,
	bucket: R2Bucket,
	id: string,
	sha256: string
) {
	const key = featureDeliveryVideoKey(id, sha256);
	const object = await bucket.head(key);
	if (!object || object.size <= 0 || object.httpMetadata?.contentType !== 'video/webm')
		return new Response(null, { status: 404 });
	const size = object.size;
	const rangeHeader = request.headers.get('range');
	const range = rangeHeader === null ? undefined : deliveryRange(rangeHeader, size);
	if (range === null)
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	const headers = new Headers({
		'Content-Type': 'video/webm',
		'Content-Length': String(range?.length ?? size),
		'Accept-Ranges': 'bytes'
	});
	if (range)
		headers.set(
			'Content-Range',
			`bytes ${range.offset}-${range.offset + range.length - 1}/${size}`
		);
	const video = request.method === 'HEAD' ? null : await bucket.get(key, { range });
	if (request.method !== 'HEAD' && video === null) return new Response(null, { status: 404 });
	return new Response(video?.body ?? null, { status: range ? 206 : 200, headers });
}
