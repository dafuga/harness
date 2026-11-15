import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Route } from '@playwright/test';
import { mediaResponse } from '../../../../src/utils/development-tooling/mediaResponse';

let retained: { mediaType: string; data: number[] } | undefined;

/** Generated player test pattern; never admitted as recorded application evidence. */
export function videoPlayerFixture(file: string) {
	if (file !== 'video-player-fixture.mp4') return undefined;
	if (!retained) {
		const directory = mkdtempSync(join(tmpdir(), 'harness-video-player-'));
		const file = join(directory, 'fixture.mp4');
		try {
			execFileSync(
				'ffmpeg',
				[
					'-hide_banner',
					'-loglevel',
					'error',
					'-f',
					'lavfi',
					'-i',
					'testsrc2=size=160x120:rate=10:duration=1',
					'-an',
					'-c:v',
					'libx264',
					'-threads',
					'1',
					'-pix_fmt',
					'yuv420p',
					'-movflags',
					'+faststart',
					'-f',
					'mp4',
					file
				],
				{ timeout: 5000, maxBuffer: 2 * 1024 * 1024 }
			);
			retained = { mediaType: 'video/mp4', data: [...readFileSync(file)] };
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
	return retained;
}

/** Serve the player's bytes with the application's real range-response behavior. */
export async function serveVideoPlayerFixture(route: Route) {
	const fixture = videoPlayerFixture('video-player-fixture.mp4')!;
	const response = mediaResponse(
		Buffer.from(fixture.data),
		fixture.mediaType,
		route.request().headers().range
	);
	return route.fulfill({
		status: response.status,
		headers: Object.fromEntries(response.headers),
		body: Buffer.from(await response.arrayBuffer())
	});
}
