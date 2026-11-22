// @harness-uid u_2eznkaf4qv
import { VideoArchiveService } from './VideoArchiveService';
import { VideoReferenceService } from './VideoReferenceService';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { captureSelection } from './video-capture-service/captureSelection';
import { captureProtocol } from './video-capture-service/captureProtocol';
import { captureRun } from './video-capture-service/captureRun';
import { recordingAllowed } from './video-capture-service/captureScript';
import { captureReceipt } from './video-capture-service/captureReceipt';
import { captureResult } from './video-capture-service/captureResult';
import { captureContext } from './video-capture-service/captureContext';
import { captureReceiptStore } from './video-capture-service/captureReceiptStore';
import type {
	VideoCaptureInput,
	VideoCaptureOptions,
	VideoCapturePlan,
	VideoCaptureResult,
	VideoCaptureServices
} from './VideoCaptureService.types';

/** Selection and trusted reuse precede every fixture import, browser factory and native context. */
export class VideoCaptureService {
	constructor(
		private readonly root: string = process.cwd(),
		private readonly services: VideoCaptureServices = {}
	) {}
	run(): string {
		return 'video-capture';
	}
	async plan(input: VideoCaptureInput): Promise<VideoCapturePlan> {
		return captureSelection(
			input,
			this.services.references ??
				new VideoReferenceService(
					this.root,
					input.pinned ?? captureContext(input, this.root)?.pinned
				),
			this.root
		);
	}
	async record(input: VideoCaptureOptions): Promise<VideoCaptureResult> {
		const plan = await this.plan(input);
		if (plan.record.length) {
			recordingAllowed(input);
			if (!input.browserFactory || !input.loadScript)
				throw new ExpectedCliError(
					'Stale video slots require an explicit task-owned browser factory and script loader.'
				);
		}
		const protocol = captureProtocol(input.directory);
		const result = captureResult(input.source, plan, protocol);
		if (plan.record.length)
			await captureRun(this.root, input, plan, {
				services: {
					...this.services,
					archive: this.services.archive ?? new VideoArchiveService(this.root)
				},
				protocol,
				result
			});
		return result;
	}
	async acknowledge(result: VideoCaptureResult, record: string): Promise<void> {
		return captureReceipt(this.root, result, record, {
			...this.services,
			references: this.services.references ?? new VideoReferenceService(this.root)
		});
	}
	/** Companion-process handoff; a descriptor still needs an authoritative attached receipt. */
	async acknowledgeDirectory(directory: string, record: string): Promise<void> {
		return this.acknowledge(captureReceiptStore(directory), record);
	}
}
export type {
	VideoCaptureInput,
	VideoCaptureOptions,
	VideoCapturePlan,
	VideoCaptureResult,
	VideoCaptureScript,
	VideoCaptureScriptInput,
	VideoCaptureEnvironment
} from './VideoCaptureService.types';
