import { execFileSync } from 'node:child_process';

let retained: { mediaType: string; data: number[] } | undefined;

/** Generated player test pattern; never admitted as recorded application evidence. */
export function videoPlayerFixture(file: string) {
	if (file !== 'video-player-fixture.mp4') return undefined;
	if (!retained) {
		const bytes = execFileSync(
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
				'frag_keyframe+empty_moov',
				'-f',
				'mp4',
				'pipe:1'
			],
			{ timeout: 5000, maxBuffer: 2 * 1024 * 1024 }
		);
		retained = { mediaType: 'video/mp4', data: [...bytes] };
	}
	return retained;
}
