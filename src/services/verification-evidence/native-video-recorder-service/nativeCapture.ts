// @harness-uid u_akqk4uwm6b
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	NativeCapture,
	NativeRecordingOptions,
	NativeRecordingSession
} from '../NativeVideoRecorderService.types';
import { nativeVisit } from './nativeVisit';
import { nativeFrameWriter } from './nativeFrames';
import { recordingFailure } from './nativeFiles';
import { removeRecordingMarker, showRecordingMarker, verifyRecordingMarker } from './nativeMarker';

export async function captureNativeFrames(
	options: NativeRecordingOptions,
	directory: string
): Promise<NativeCapture> {
	const context = await options.browser.newContext({
		viewport: options.viewport,
		deviceScaleFactor: 1,
		reducedMotion: 'no-preference',
		locale: 'en-US',
		timezoneId: 'UTC'
	});
	let session: NativeRecordingSession | undefined;
	try {
		options.diagnostics.watch(context);
		const page = await context.newPage();
		session = { context, page };
		page.setDefaultTimeout(10_000);
		await recordingDeadline(
			prepareRecording(options, session),
			60_000,
			'native recording setup timed out'
		);
		return await recordingDeadline(
			capturePrepared(options, session, directory),
			17_000,
			'native recording exceeded 17 second acquisition limit'
		);
	} finally {
		try {
			if (options.reset && session)
				await recordingDeadline(options.reset(session), 5_000, 'native recording reset timed out');
		} finally {
			try {
				await context.close();
			} finally {
				await options.diagnostics.finish();
			}
		}
	}
}
async function prepareRecording(
	options: NativeRecordingOptions,
	session: NativeRecordingSession
): Promise<void> {
	await options.prepare(session);
	await session.page.emulateMedia({ reducedMotion: 'no-preference' });
	await session.page.evaluate(async () => {
		await globalThis.document.fonts.ready;
		await Promise.all(
			[...globalThis.document.images]
				.filter((image) => image.getBoundingClientRect().width > 0)
				.map((image) => image.decode())
		);
	});
}
async function capturePrepared(
	options: NativeRecordingOptions,
	session: NativeRecordingSession,
	directory: string
): Promise<NativeCapture> {
	const { page } = session,
		writer = nativeFrameWriter(directory, options.viewport);
	const events: NativeCapture['events'] = [];
	const shownTimestamp = await showRecordingMarker(page);
	await page.screencast.start({
		size: options.viewport,
		quality: 90,
		onFrame: (frame) => writer.append(frame)
	});
	try {
		await recordingDeadline(
			waitForFirstFrame(writer.frames),
			3_000,
			'native recorder produced no frame'
		);
		await page.waitForTimeout(80);
		const removedTimestamp = await removeRecordingMarker(page);
		await page.waitForTimeout(350);
		const mark = async (kind: 'trigger' | 'state' | 'edge', id: string) => {
			if (!id.trim() || id.length > 200 || events.length >= 256)
				recordingFailure('invalid native recording event');
			events.push(await nativeVisit(page, writer.frames, kind, id));
		};
		await mark('trigger', 'trigger');
		await options.perform({ ...session, mark });
		if (!events.some((event) => event.kind === 'state'))
			recordingFailure('native recording requires a visible state assertion');
		await page.waitForTimeout(550);
		writer.check();
		const marker = {
			shownTimestamp,
			removedTimestamp,
			nativeTimestamp: writer.frames[0].timestamp
		};
		verifyRecordingMarker(directory, writer.frames[0], marker);
		const finishedTimestamp = await page.evaluate(() => performance.timeOrigin + performance.now());
		return { frames: writer.frames, events, marker, finishedTimestamp };
	} finally {
		try {
			await page.screencast.stop();
		} finally {
			writeNativeDiagnostics(directory, writer.frames, events);
			writer.check();
		}
	}
}
async function waitForFirstFrame(frames: NativeCapture['frames']): Promise<void> {
	for (let attempt = 0; attempt < 300 && !frames.length; attempt++)
		await new Promise((resolve) => setTimeout(resolve, 10));
	if (!frames.length) recordingFailure('native recorder produced no frame');
}
export async function recordingDeadline<T>(
	operation: Promise<T>,
	milliseconds: number,
	message: string
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(message)), milliseconds);
			})
		]);
	} finally {
		clearTimeout(timeout);
	}
}

function writeNativeDiagnostics(
	directory: string,
	frames: NativeCapture['frames'],
	events: NativeCapture['events']
): void {
	writeFileSync(join(directory, 'acquisition.json'), JSON.stringify({ frames, events }));
}
