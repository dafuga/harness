// @harness-uid u_hubmac2222
/** The one public Mac archive. Its name is fixed here; the request URL never builds a storage key. */
const ARCHIVE = 'Harness-mac-arm64.zip';
const PATH = `/downloads/${ARCHIVE}`;
/** Only the provisioner's immutable key shape reaches storage; anything else is refused first. */
const KEY_SHAPE = /^releases\/mac-arm64\/[0-9a-f]{40}\/Harness\.zip$/;

/**
 * SvelteKit's default would 308 `/…zip/` to `/…zip`, handing a trailing-slash alias the vetted
 * archive. `ignore` leaves the path as requested, so isVettedRequest refuses the alias with a 404.
 */
export const trailingSlash = 'ignore';

/** One opaque body for every refusal: it names no key, prefix, binding or archive. */
function notFound(): Response {
	return new Response('Not found', {
		status: 404,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff'
		}
	});
}

/** Archive metadata. No caching, so a rollback cannot leave the old route in a cache. */
function archiveHeaders(size: number): Headers {
	return new Headers({
		'content-type': 'application/zip',
		'content-disposition': `attachment; filename="${ARCHIVE}"`,
		'content-length': String(size),
		'x-content-type-options': 'nosniff',
		'cache-control': 'no-store'
	});
}

/** The provisioned key when it is present and in the immutable shape; otherwise undefined. */
function vettedKey(platform: App.Platform | undefined): string | undefined {
	const key = platform?.env?.HARNESS_MAC_DOWNLOAD_KEY;
	return key !== undefined && KEY_SHAPE.test(key) ? key : undefined;
}

/** Refuses other names, aliases, trailing slashes and any nonempty query before storage is used. */
function isVettedRequest(url: URL, asset: string): boolean {
	return asset === ARCHIVE && url.pathname === PATH && url.search === '';
}

/** Streams the archive body. Nothing is buffered, and the bytes are read only when the client reads them. */
export async function GET({
	url,
	params,
	platform
}: {
	url: URL;
	params: { asset: string };
	platform: App.Platform | undefined;
}): Promise<Response> {
	const bucket = platform?.env?.DOWNLOADS;
	const key = vettedKey(platform);
	if (!bucket || !key || !isVettedRequest(url, params.asset)) return notFound();
	const object = await bucket.get(key);
	if (!object) return notFound();
	// The Workers R2 body stream is the runtime's own ReadableStream; the DOM typings name it differently.
	const body = object.body as unknown as BodyInit;
	return new Response(body, { headers: archiveHeaders(object.size) });
}

/** Returns the archive metadata only. The object is looked up with head(), so no bytes are read. */
export async function HEAD({
	url,
	params,
	platform
}: {
	url: URL;
	params: { asset: string };
	platform: App.Platform | undefined;
}): Promise<Response> {
	const bucket = platform?.env?.DOWNLOADS;
	const key = vettedKey(platform);
	if (!bucket || !key || !isVettedRequest(url, params.asset)) return notFound();
	const object = await bucket.head(key);
	if (!object) return notFound();
	return new Response(null, { headers: archiveHeaders(object.size) });
}
