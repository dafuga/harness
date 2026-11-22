import type { Route } from '@playwright/test';
import { videoFixtureFlags } from './videoCatalogVariants';

/** Deliberate response-shape failure exercises the visible alert without a network console error. */
export function serveVideoFeedback(route: Route) {
	const query = new URL(route.request().frame().page().url()).searchParams;
	const video = query.get('unit') === 'reports.component.verification-evidence-video-evidence';
	return route.fulfill({
		json:
			video && query.get('variant') === 'error'
				? { error: 'Synthetic invalid feedback response.' }
				: { flags: video ? videoFixtureFlags(query.get('variant') ?? '') : [] }
	});
}
