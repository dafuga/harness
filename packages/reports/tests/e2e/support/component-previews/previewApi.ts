import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildData } from './buildData';
import { index, revision, record } from '../../../../test/entityFixture';
import { commits } from '../../../../test/entityUnits';
import { cpu } from './analytics';
import { activity, live } from './activity';
import { image, layoutImage, picker } from './shared';
import { audioFixture } from '../../../../test/audioFixture';
import { routeIndex, routeRevision } from './routeHistory';
import { routePreview } from './visualUnits';
// Sealed once, when the first preview asks for media; importing this module launches nothing.
let sealed: ReturnType<typeof buildData> | undefined;
/** The pages a route module was opened in, by the unit their document asked for. */
const routed = new WeakSet<Page>();
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
	const shown = historyOf(route, url);
	const given: Record<string, unknown> = {
		'/api/analytics-cpu': cpu,
		'/api/project-activity': { activity, live },
		'/tools': picker,
		'/harness/data/index.json': shown.index,
		'/harness/data/activity.json': activity
	};
	if (url.pathname in given) return route.fulfill({ json: given[url.pathname] });
	const commit = /\/data\/revisions\/([a-f0-9]+)\.json$/.exec(url.pathname)?.[1];
	if (commit) return route.fulfill({ json: shown.revision(commit) });
	if (url.pathname !== '/') throw new Error(`Unexpected preview request: ${url.pathname}`);
	return route.fulfill({
		contentType: 'text/html',
		body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Component preview</title><link rel="stylesheet" href="/page.css"></head><body><div id="app"></div><script src="/page.iife.js"></script></body></html>'
	});
}
/**
 * The history a page reads: a route module reads the route history, where every category has an
 * entity, and any other preview the orders fixture it has always read.
 */
function historyOf(route: Route, url: URL) {
	const page = route.request().frame().page();
	if (url.pathname === '/') {
		if (routePreview(url.searchParams.get('unit') ?? '')) routed.add(page);
		else routed.delete(page);
	}
	if (routed.has(page)) return { index: routeIndex, revision: routeRevision };
	return { index, revision: (commit: string) => revision(commit, [record(commit)]) };
}
async function media(route: Route, path: string) {
	const all = await (sealed ??= buildData());
	const file = path.split('/').pop()!;
	const artifact = artifactByName(all, file);
	if (artifact)
		return route.fulfill({ contentType: artifact.mediaType, body: Buffer.from(artifact.data) });
	// A sealed result is kept under its hash, as the function results of the route history are.
	const kept = all.bytes[file.replace(/\.[^.]+$/, '')];
	if (kept) return route.fulfill({ contentType: kept.mediaType, body: Buffer.from(kept.data) });
	if (file === 'preview.wav')
		return route.fulfill({ contentType: 'audio/wav', body: audioFixture(1) });
	if (file === 'synthetic-layout-input.svg')
		return route.fulfill({ contentType: 'image/svg+xml', body: layoutImage });
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

/** Recorded artifact bytes by their served filename; a declared artifact cannot fall back to a stand-in. */
function artifactByName(all: Awaited<ReturnType<typeof buildData>>, file: string) {
	for (const result of Object.values(all.results)) {
		for (const row of result.behavior.rows) {
			for (const capture of [row.before, row.after]) {
				if (capture?.media?.split('/').pop() !== file) continue;
				const held = all.bytes[capture.sha256];
				if (!held) throw new Error(`Missing recorded fixture artifact ${file}`);
				return held;
			}
		}
	}
	return undefined;
}
