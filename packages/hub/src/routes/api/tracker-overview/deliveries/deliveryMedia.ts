import { featureDeliveryVideoKey } from '../../../../../../../src/core/projects-sessions/featureDelivery';
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
	const response = featureVideoResponse(size, range);
	if (request.method === 'HEAD') return new Response(null, response);
	const video = await bucket.get(key, { range });
	return video ? new Response(video.body, response) : new Response(null, { status: 404 });
}

function featureVideoResponse(size: number, range?: NonNullable<ReturnType<typeof deliveryRange>>) {
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
	return { status: range ? 206 : 200, headers };
}
