import type { Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildData } from './buildData';
import { index, revision, record } from '../../../../test/entityFixture';
import { commits } from '../../../../test/entityUnits';
import { cpu } from './analytics';
import { activity, live } from './activity';
import { image, picker } from './shared';
import { audioFixture } from '../../../../test/audioFixture';
// Sealed once, when the first preview asks for media; importing this module launches nothing.
let sealed: ReturnType<typeof buildData> | undefined;
const fixtureMedia = new Set(
	Object.values(commits).flatMap((commit) =>
		record(commit).scenarios.flatMap((scenario) =>
			scenario.states.flatMap((state) =>
				state.captures.map((capture) => capture.media?.split('/').pop())
			)
		)
	)
);
export const previewOrigin = 'http://127.0.0.1:47999';
export async function servePreview(route: Route, home: string) {
	const url = new URL(route.request().url());
	const file = /\/(page\.(?:iife\.js|css))$/.exec(url.pathname)?.[1];
	if (file)
		return route.fulfill({
			contentType: file.endsWith('css') ? 'text/css' : 'text/javascript',
			body: readFileSync(join(home, 'catalog', file))
		});
	if (/^\/(?:harness\/)?media\//.test(url.pathname)) return media(route, url.pathname);
	const given: Record<string, unknown> = {
		'/api/analytics-cpu': cpu,
		'/api/project-activity': { activity, live },
		'/tools': picker,
		'/harness/data/index.json': index,
		'/harness/data/activity.json': activity
	};
	if (url.pathname in given) return route.fulfill({ json: given[url.pathname] });
	const commit = /\/data\/revisions\/([a-f0-9]+)\.json$/.exec(url.pathname)?.[1];
	if (commit) return route.fulfill({ json: revision(commit, [record(commit)]) });
	if (url.pathname !== '/') throw new Error(`Unexpected preview request: ${url.pathname}`);
	return route.fulfill({
		contentType: 'text/html',
		body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Component preview</title><link rel="stylesheet" href="/page.css"></head><body><div id="app"></div><script src="/page.iife.js"></script></body></html>'
	});
}
async function media(route: Route, path: string) {
	const all = await (sealed ??= buildData());
	const file = path.split('/').pop()!;
	for (const result of Object.values(all.results)) {
		for (const row of result.behavior.rows) {
			for (const capture of [row.before, row.after]) {
				if (capture?.media?.split('/').pop() === file) {
					const held = all.bytes[capture.sha256];
					return route.fulfill({ contentType: held.mediaType, body: Buffer.from(held.data) });
				}
			}
		}
	}
	if (file === 'preview.wav')
		return route.fulfill({ contentType: 'audio/wav', body: audioFixture(1) });
	if (file !== 'synthetic-card-input.svg' && !fixtureMedia.has(file))
		return route.fulfill({
			status: 404,
			contentType: 'text/plain',
			body: 'Undeclared preview media'
		});
	return route.fulfill({
		contentType: 'image/svg+xml',
		body: decodeURIComponent(image.split(',')[1])
	});
}
