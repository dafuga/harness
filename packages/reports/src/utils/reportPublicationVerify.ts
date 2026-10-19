import { createHash } from 'node:crypto';
import type { PublicationBundle } from './reportPublication';
export async function reportPublicationVerify(
	bundle: PublicationBundle,
	url: string,
	request: (input: string | URL | Request, init?: RequestInit) => Promise<Response> = fetch
) {
	if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev\/?$/.test(url))
		throw new Error('Invalid Cloudflare Pages deployment URL');
	for (const file of bundle.files) {
		const path = file.path === 'index.html' ? '' : file.path;
		const response = await request(new URL(path, url.endsWith('/') ? url : url + '/'), {
			signal: AbortSignal.timeout(30000)
		});
		if (!response.ok)
			throw new Error(`Published file unavailable: ${file.path} (${response.status})`);
		const bytes = Buffer.from(await response.arrayBuffer());
		const digest = createHash('sha256').update(bytes).digest('hex');
		if (digest !== file.sha256) throw new Error(`Published file digest differs: ${file.path}`);
		if (!response.headers.get('content-type')?.startsWith(file.mime))
			throw new Error(`Published file MIME differs: ${file.path}`);
	}
}
