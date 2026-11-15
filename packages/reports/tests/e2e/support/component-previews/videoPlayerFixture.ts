import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
