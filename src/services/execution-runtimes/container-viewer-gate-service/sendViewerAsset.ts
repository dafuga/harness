// @harness-uid u_a765656xhd
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, join, sep } from 'node:path';
import { refuse } from './viewerPages';

const types: Record<string, string> = {
	'.css': 'text/css',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.oga': 'audio/ogg',
	'.mp3': 'audio/mpeg',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf'
};

/** Serves one file of the noVNC client, never anything outside its directory. */
export async function sendViewerAsset(
	response: ServerResponse,
	root: string,
	pathname: string
): Promise<void> {
	try {
		const base = await realpath(root);
		const path = await realpath(join(base, decodeURIComponent(pathname)));
		if (!path.startsWith(base + sep) || !(await stat(path)).isFile()) {
			refuse(response, 404);
			return;
		}
		response.writeHead(200, {
			'content-type': types[extname(path)] ?? 'application/octet-stream',
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer',
			'x-content-type-options': 'nosniff',
			'x-frame-options': pathname === '/vnc.html' ? 'SAMEORIGIN' : 'DENY'
		});
		createReadStream(path).pipe(response);
	} catch {
		refuse(response, 404);
	}
}
