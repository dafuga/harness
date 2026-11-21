// @harness-uid u_cn3dpo22jm
/**
 * A download's address, once the Hub really serves it: a same-origin HEAD that answers 200 with
 * the expected media type. A missing, redirected, differently typed or unreachable file is null,
 * so the page keeps its pending state instead of linking to something that is not there.
 */
export async function publishedDownload(
	path: string,
	mediaType: string,
	request: typeof fetch = fetch
): Promise<string | null> {
	if (!path.startsWith('/') || path.startsWith('//')) return null;
	try {
		const response = await request(path, {
			method: 'HEAD',
			cache: 'no-store',
			credentials: 'omit',
			redirect: 'error'
		});
		const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
		return response.status === 200 && type === mediaType ? path : null;
	} catch {
		return null;
	}
}
