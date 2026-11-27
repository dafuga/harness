// @harness-uid u_zbb5krf6rd
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { RendererAssetMissingError } from './rendererAssets.types';

const types: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2'
};

/**
 * `connect` names the one address beside the app itself that a page may open: its own socket.
 * A picture or a recorded clip may come from an object URL the page made of bytes it checked;
 * no script, frame or object may. Home and Plans and schedule also display HTTPS mockups.
 */
export function rendererPolicy(html: string, connect = '', planningImages = false): string {
	const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
		(m) => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'"
	);
	return (
		"default-src 'self'; script-src 'self' " +
		hashes.join(' ') +
		"; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:" +
		(planningImages ? ' https:' : '') +
		"; media-src 'self' blob:; font-src 'self'; connect-src 'self'" +
		(connect ? ' ' + connect : '') +
		"; frame-src 'none'; object-src 'none'; base-uri 'none'"
	);
}

function assetPath(url: string): string | null {
	const address = new URL(url);
	if (address.protocol !== 'harness:' || address.hostname !== 'app') return null;
	const path = decodeURIComponent(address.pathname);
	if (path.includes('\0') || path.split('/').includes('..')) return null;
	return path;
}

async function rendererFile(root: string, path: string): Promise<string> {
	const file = resolve(root, '.' + path);
	try {
		if (!(await stat(file)).isFile()) throw new RendererAssetMissingError('Missing');
	} catch {
		return resolve(root, 'index.html');
	}
	return file;
}

export async function rendererAssets(root: string, url: string, connect = ''): Promise<Response> {
	const path = assetPath(url);
	if (path === null) return new Response('Refused', { status: 403 });
	const actual = await realpath(await rendererFile(root, path)),
		inside = relative(await realpath(root), actual);
	if (inside.startsWith('..') || inside.startsWith('/'))
		return new Response('Refused', { status: 403 });
	const bytes = await readFile(actual),
		html = extname(actual) === '.html';
	const request = new URL(url);
	const planningImages =
		html && (path === '/' || (path === '/tracker' && request.searchParams.get('view') === 'work'));
	return new Response(bytes, {
		headers: {
			'Content-Type': types[extname(actual)] ?? 'application/octet-stream',
			'Content-Security-Policy': rendererPolicy(
				html ? bytes.toString() : '',
				connect,
				planningImages
			),
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
