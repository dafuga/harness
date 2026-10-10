/**
 * A fixture site that is really compiled and really served: `build.mjs` compiles the source
 * into a build directory, `serve.mjs` is an HTTP server for one build directory that reports
 * the identity of the files it serves, and `served.mjs` is the check that captures from it.
 */
const build = String.raw`
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'build';
const read = (path) => readFileSync(path, 'utf8');
const sources = ['src/utils/slugify.ts', 'src/services/TitleService.ts', 'src/routes/titles/+page.svelte'];
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'assets/app.js'), '// compiled titles page\n' + sources.map(read).join('\n'));
writeFileSync(join(out, 'index.html'), '<!doctype html><title>Titles</title><script src="/assets/app.js"></script>\n');
`;

const serve = String.raw`
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';

const directory = process.argv[2];
// The identity is computed once, from the files this process serves, before it accepts a request.
function identity() {
	try {
		const cli = ['bun', process.env.HARNESS_CLI_PATH, 'verify', 'identity', directory, '--json'];
		return JSON.parse(execFileSync(cli[0], cli.slice(1), { encoding: 'utf8' })).buildId;
	} catch {
		return 'unidentified';
	}
}
const served = { buildId: identity(), revision: process.env.SERVED_REVISION };
const server = createServer((request, response) => {
	const path = normalize(new URL(request.url, 'http://localhost').pathname);
	if (path === '/build.json') return response.end(JSON.stringify(served));
	try {
		response.end(readFileSync(join(directory, path === '/' ? 'index.html' : path)));
	} catch {
		response.writeHead(404).end('not found');
	}
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
`;

const served = String.raw`
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const env = process.env;
const dir = env.HARNESS_EVIDENCE_DIR;
const sizes = { desktop: [1440, 900], tablet: [920, 800], mobile: [390, 844] };
function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
	return out;
}
function png(width, height, shade) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	const row = Buffer.alloc(1 + width, shade);
	row[0] = 0;
	const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}
if (!dir || env.TAKE_SCREENSHOT !== '1') process.exit(0);

// A deployment that was never rebuilt serves FIXTURE_OLD_BUNDLE, yet is told the new revision.
const directory = env.FIXTURE_OLD_BUNDLE ?? 'build';
const child = spawn(process.execPath, ['scripts/serve.mjs', directory], {
	env: { ...env, SERVED_REVISION: env.HARNESS_VERIFY_REVISION },
	stdio: ['ignore', 'pipe', 'inherit']
});
const port = await new Promise((resolve) => child.stdout.once('data', (text) => resolve(Number(String(text)))));
const origin = 'http://127.0.0.1:' + port;
const server = await (await fetch(origin + '/build.json')).json();
const page = await (await fetch(origin + '/assets/app.js')).text();
child.kill();

mkdirSync(dir, { recursive: true });
for (const state of ['empty', 'filled']) {
	for (const viewport of ['desktop', 'tablet', 'mobile']) {
		const file = state + '-' + viewport + '.png';
		const shade = (page.length + (state === 'empty' ? 0 : 97)) % 251;
		writeFileSync(join(dir, file), png(...sizes[viewport], shade));
		const line = { evidence: 'screens', kind: 'screenshot', state, viewport, file, mediaType: 'image/png', server };
		appendFileSync(join(dir, 'captures.ndjson'), JSON.stringify(line) + '\n');
	}
}
`;

export const servedSources: Record<string, string> = {
	'scripts/build.mjs': build,
	'scripts/serve.mjs': serve,
	'scripts/served.mjs': served
};
