// @harness-uid u_2eznkaf4qv
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NativeVideoRecorderService } from '../NativeVideoRecorderService';
import { captureScriptInput, admittedScript, captureCheckpoint } from './captureScript';
import { convertedCapture } from './captureConversion';
import { captureBatch } from './captureBatch';
import type { Browser } from '@playwright/test';
import type {
	VideoCaptureOptions,
	VideoCapturePlan,
	VideoCaptureResult,
	VideoCaptureServices,
	VideoCaptureScriptInput,
	VideoCaptureScript
} from '../VideoCaptureService.types';
import type { captureProtocol } from './captureProtocol';

/** A fresh run namespace prevents unknown/stale reasons from falling through to an old native cache. */
export async function captureRun(
	root: string,
	options: VideoCaptureOptions,
	plan: VideoCapturePlan,
	context: {
		services: VideoCaptureServices;
		protocol: ReturnType<typeof captureProtocol>;
		result: VideoCaptureResult;
	}
): Promise<void> {
	const base = join(root, '.cache/harness/video-capture');
	mkdirSync(base, { recursive: true });
	const cacheRoot = mkdtempSync(join(base, 'run-'));
	const native = context.services.native?.(cacheRoot) ?? new NativeVideoRecorderService(cacheRoot);
	const archive = captureBatch(context.services.archive!, context.protocol, context.result);
	let browser: Browser | undefined;
	try {
		for (const slot of plan.record) {
			const target = captureScriptInput(plan, slot),
				script = await options.loadScript!(target);
			admittedScript(script, target, plan);
			browser ??= await options.browserFactory!();
			const produced = await recordSlot(options, target, script, { browser, native, cacheRoot });
			await archive.append(produced);
		}
		await archive.flush();
		writeFileSync(
			join(options.directory, 'video-raw-receipts.json'),
			JSON.stringify({
				source: context.result.source,
				videoBatches: context.result.videoBatches,
				raw: context.result.raw
			})
		);
	} finally {
		await browser?.close();
	}
}
async function recordSlot(
	options: VideoCaptureOptions,
	target: VideoCaptureScriptInput,
	script: VideoCaptureScript,
	context: {
		browser: Browser;
		native: ReturnType<NonNullable<VideoCaptureServices['native']>>;
		cacheRoot: string;
	}
) {
	const signatures: { entry?: string; exit?: string } = {};
	const native = await context.native.record({
		browser: context.browser,
		slotKey: JSON.stringify([target.slot.unit, target.slot.clipId, target.slot.viewport]),
		inputHash: target.slot.inputHash,
		viewport: target.viewport,
		testedRevision: options.source.commit,
		addressedFlags: script.addressedFlags,
		diagnostics: script.diagnostics,
		prepare: async (session) => {
			await script.prepare(session);
			signatures.entry = await captureCheckpoint(script, target, session, 'entry');
		},
		perform: async (session) => {
			await script.perform(session);
			signatures.exit = await captureCheckpoint(script, target, session, 'exit');
		},
		...(script.reset ? { reset: script.reset } : {})
	});
	return convertedCapture(options, target, native, { signatures, cacheRoot: context.cacheRoot });
}
