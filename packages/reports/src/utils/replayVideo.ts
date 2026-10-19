import { writeFile, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Report } from '../models/Report.types';
import { replayFrames, FRAME_SECONDS } from './replayFrames';
import { registeredAsset } from './reportAssets';
import { reportProcess } from './reportProcess';
export function replayVideoKey(report: Report) {
	return createHash('sha256')
		.update(
			JSON.stringify(replayFrames(report.evidence).map((f) => [f.item.id, f.item.file])) +
				':3s:1280x720:v2'
		)
		.digest('hex');
}
export async function replayVideo(report: Report, directory: string) {
	const frames = replayFrames(report.evidence);
	if (!frames.length || frames.length > 500)
		throw new Error('Replay requires between 1 and 500 available screenshots');
	const cache = join(directory, 'replays');
	if ((await lstat(cache).catch(() => undefined))?.isSymbolicLink())
		throw new Error('Invalid replay directory');
	await mkdir(cache, { recursive: true, mode: 0o700 });
	const destination = join(cache, replayVideoKey(report) + '.mp4');
	const info = await lstat(destination).catch(() => null);
	if (info?.isSymbolicLink()) throw new Error('Invalid replay artifact');
	if (info?.isFile()) return destination;
	const temporary = await mkdtemp(join(cache, 'encode-'));
	try {
		const names = await copyFrames(report, directory, temporary);
		await encodeReplay(names, temporary);
		await rename(join(temporary, 'video.mp4'), destination);
		return destination;
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
async function copyFrames(report: Report, directory: string, temporary: string) {
	const frames = replayFrames(report.evidence),
		names: string[] = [];
	const registered = report.evidence.map((item) => item.file);
	for (let offset = 0; offset < frames.length; offset += 4) {
		const batch = await Promise.all(
			frames.slice(offset, offset + 4).map(async (frame, index) => {
				const source = await registeredAsset(
					join(directory, 'assets'),
					frame.item.file,
					registered
				);
				const name = `frame-${String(offset + index).padStart(4, '0')}.png`;
				const result = await reportProcess(
					process.env.PROJECT_REPORTS_FFMPEG || 'ffmpeg',
					[
						'-hide_banner',
						'-loglevel',
						'error',
						'-y',
						'-i',
						source,
						'-frames:v',
						'1',
						'-vf',
						'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
						'-threads',
						'1',
						name
					],
					temporary
				);
				if (result.code !== 0) throw new Error('A screenshot could not be rendered for the video');
				return name;
			})
		);
		names.push(...batch);
	}
	return names;
}
async function encodeReplay(names: string[], directory: string) {
	const entries =
		names.map((name) => `file '${name}'\nduration ${FRAME_SECONDS}\n`).join('') +
		`file '${names.at(-1)}'\n`;
	await writeFile(join(directory, 'frames.txt'), entries, { mode: 0o600 });
	const result = await reportProcess(
		process.env.PROJECT_REPORTS_FFMPEG || 'ffmpeg',
		[
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-f',
			'concat',
			'-safe',
			'1',
			'-i',
			'frames.txt',
			'-vf',
			'fps=10,tpad=stop_mode=clone:stop_duration=3',
			'-r',
			'10',
			'-fps_mode',
			'cfr',
			'-t',
			String(names.length * FRAME_SECONDS),
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			'24',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			'video.mp4'
		],
		directory
	);
	if (result.code !== 0)
		throw new Error('Video generation failed. The screenshot replay remains available.');
}
