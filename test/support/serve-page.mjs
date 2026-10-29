
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { render } from 'svelte/server';
import Page from '../../.cache/harness/titles-page/page.mjs';
const identity = JSON.parse(execFileSync('bun', [process.env.HARNESS_CLI_PATH, 'verify', 'identity', '.cache/harness/titles-page', '--json'], { encoding: 'utf8' }));
const stamp = { buildId: identity.buildId, revision: process.env.HARNESS_VERIFY_REVISION };
const server = createServer((request, response) => {
 const url = new URL(request.url, 'http://localhost');
 if (url.pathname === '/build.json') return response.end(JSON.stringify(stamp));
 const page = render(Page, { props: { filled: url.searchParams.get('state') === 'filled' } });
 response.setHeader('content-type', 'text/html');
 response.end('<!doctype html><html><head><title>Titles fixture</title>' + page.head + '</head><body>' + page.body + '</body></html>');
});
server.listen(0, '127.0.0.1', () => { writeFileSync('.cache/harness/titles-port', String(server.address().port)); console.log('fixture-ready'); });
