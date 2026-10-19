import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';

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
 * no script, frame or object may, and nothing may come from another origin.
 */
export function rendererPolicy(html: string, connect = ''): string {
	const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
		(m) => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'"
	);
	return (
		"default-src 'self'; script-src 'self' " +
		hashes.join(' ') +
		"; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'" +
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

export async function rendererAssets(root: string, url: string, connect = ''): Promise<Response> {
	const path = assetPath(url);
	if (path === null) return new Response('Refused', { status: 403 });
	let file = resolve(root, '.' + path);
	try {
		if (!(await stat(file)).isFile()) throw new Error('Missing');
	} catch {
		file = resolve(root, 'index.html');
	}
	const actual = await realpath(file),
		inside = relative(await realpath(root), actual);
	if (inside.startsWith('..') || inside.startsWith('/'))
		return new Response('Refused', { status: 403 });
	const bytes = await readFile(actual),
		html = extname(actual) === '.html';
	return new Response(bytes, {
		headers: {
			'Content-Type': types[extname(actual)] ?? 'application/octet-stream',
			'Content-Security-Policy': rendererPolicy(html ? bytes.toString() : '', connect),
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
