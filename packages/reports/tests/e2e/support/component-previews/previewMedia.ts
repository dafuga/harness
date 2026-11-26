import type { Route } from '@playwright/test';
import { catalogFixtureMedia } from './catalogFixtureMedia';
import { shellMedia } from './shellArtworkImages';
import { serveVideoPlayerFixture } from './videoPlayerFixture';
import { record } from '../../../../test/entityFixture';
import { commits } from '../../../../test/entityUnits';
import { image, layoutImage, ordersPageImage } from './shared';
import {
	checkoutBefore,
	checkoutConfirmation,
	checkoutMobile,
	checkoutTablet
} from './evidenceCardMedia';
import { audioFixture } from '../../../../test/audioFixture';

const fixtureMedia = new Set(
	Object.values(commits).flatMap((commit) =>
		record(commit).scenarios.flatMap((scenario) =>
			scenario.states.flatMap((state) =>
				state.captures.map((capture) => capture.media?.split('/').pop())
			)
		)
	)
);
const syntheticMedia = new Map<string, { contentType: string; body: string }>([
	['preview-corrupt.wav', { contentType: 'audio/wav', body: 'Invalid audio fixture.' }],
	['checkout-confirmation.svg', { contentType: 'image/svg+xml', body: checkoutConfirmation }],
	['checkout-before.svg', { contentType: 'image/svg+xml', body: checkoutBefore }],
	['checkout-mobile.svg', { contentType: 'image/svg+xml', body: checkoutMobile }],
	['checkout-tablet.svg', { contentType: 'image/svg+xml', body: checkoutTablet }],
	['preview-invalid-image.svg', { contentType: 'image/svg+xml', body: 'Invalid image fixture.' }],
	['synthetic-layout-input.svg', { contentType: 'image/svg+xml', body: layoutImage }],
	['synthetic-orders-page-input.svg', { contentType: 'image/svg+xml', body: ordersPageImage }]
]);

export async function previewMedia(route: Route, path: string, home: string) {
	const all = catalogFixtureMedia(home);
	const file = path.split('/').pop()!;
	if (file === 'video-player-fixture.mp4') return serveVideoPlayerFixture(route);
	const artifact = artifactByName(all, file);
	if (artifact)
		return route.fulfill({ contentType: artifact.mediaType, body: Buffer.from(artifact.data) });
	// A sealed result is kept under its hash, as the function results of the route history are.
	const kept = storedMedia(all, file);
	if (kept) return route.fulfill({ contentType: kept.mediaType, body: Buffer.from(kept.data) });
	if (file === 'preview.wav')
		return route.fulfill({ contentType: 'audio/wav', body: audioFixture(42) });
	const synthetic = syntheticMedia.get(file);
	if (synthetic) return route.fulfill(synthetic);
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

/** Additional shell artwork shares the existing immutable-media response path. */
function storedMedia(all: ReturnType<typeof catalogFixtureMedia>, file: string) {
	const svg = shellMedia(file);
	return (
		all.bytes[file.replace(/\.[^.]+$/, '')] ??
		(svg ? { mediaType: 'image/svg+xml', data: [...Buffer.from(svg)] } : undefined)
	);
}

/** Recorded artifact bytes by their served filename; a declared artifact cannot fall back to a stand-in. */
function artifactByName(all: ReturnType<typeof catalogFixtureMedia>, file: string) {
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
