
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { render } from 'svelte/server';
import * as components from '../../.cache/harness/title-components/components.mjs';
const identity = JSON.parse(execFileSync('bun', [process.env.HARNESS_CLI_PATH, 'verify', 'identity', '.cache/harness/title-components', '--json'], { encoding: 'utf8' }));
const stamp = { buildId: identity.buildId, revision: process.env.HARNESS_VERIFY_REVISION };
const choices = { 'component.title-list': 'TitleList', 'component.title-row': 'TitleRow', 'component.title-frame': 'TitleFramePreview' };
const server = createServer((request, response) => {
 const url = new URL(request.url, 'http://localhost');
 if (url.pathname === '/build.json') return response.end(JSON.stringify(stamp));
 const Component = components[choices[url.searchParams.get('unit')]];
 if (!Component) { response.writeHead(404); return response.end(); }
 const props = JSON.parse(url.searchParams.get('props') ?? '{}');
 const page = render(Component, { props });
 response.setHeader('content-type', 'text/html');
 const margin = url.searchParams.get('unit') === 'component.title-frame' ? ' style="margin: 0"' : '';
 response.end('<!doctype html><html><head><title>Explorer component fixture</title>' + page.head + '</head><body' + margin + '>' + page.body + '</body></html>');
});
server.listen(0, '127.0.0.1', () => { writeFileSync('.cache/harness/components-port', String(server.address().port)); console.log('components-ready'); });
