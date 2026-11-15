// @harness-uid u_3exag5gqwq
import { join } from 'node:path';
import {
	captureIndex,
	captureLineSchema
} from '../../../../../core/verification-evidence/verifyTypes';
import type {
	GatherResult,
	Gathered
} from '../../../../../utils/verification-evidence/gatherCaptures';
import type { Capture } from '../../../../../core/verification-evidence/verificationTypes';
import type { CaptureLimits } from './captureLimits.types';
import type {
	CaptureGatherScope,
	VideoGatherContext,
	GatherVideoSidecar,
	VideoGatherSession
} from './gatherVideoReferences.types';
import { VideoReferenceService } from '../../../../../services/verification-evidence/VideoReferenceService';
import { evidenceDirectoryFailure } from './evidenceDirectoryFailure';
import { gatherLine, indexLines } from './gatherCaptures';
import { RecordBudget, oversizeCapture } from './captureLimits';
import { videoSidecar, sidecarCapture } from './videoSidecar';
import { admitVideoReference } from '../videoReferenceAdmission';
import { mediaFacts } from './mediaFacts';
import { videoRunReaders } from './videoRunReaders';

/** Child references are resolved before a budget exemption; their binaries never enter the parent. */
export async function gatherVerificationCaptures(
	directory: string,
	recordPath: string,
	limits: CaptureLimits = {},
	scope: CaptureGatherScope = {}
): Promise<GatherResult> {
	const result: GatherResult = { gathered: [], failures: [] };
	const refusal = evidenceDirectoryFailure(directory, scope.root ?? directory);
	if (refusal) return { ...result, failures: [refusal] };
	const session: VideoGatherSession = {
		directory,
		recordPath,
		limits,
		budget: scope.budget ?? new RecordBudget(limits.maxRecordBytes),
		video: scope.video ? { ...scope.video, references: videoRunReaders(scope.video) } : undefined
	};
	for (const text of indexLines(join(directory, captureIndex), result)) {
		try {
			await gatherIndexedCapture(text, session, result);
		} catch (error) {
			result.failures.push(
				`could not admit capture reference: ${error instanceof Error ? error.message : 'invalid capture'}`
			);
		}
	}
	return result;
}

async function gatherIndexedCapture(
	text: string,
	session: VideoGatherSession,
	result: GatherResult
): Promise<void> {
	const line = parsedLine(text);
	if (!line) {
		result.failures.push('wrote a malformed capture line');
		return;
	}
	if (!line.videoReference) {
		const item = gatherLine(text, session.directory, session);
		if (typeof item === 'string') result.failures.push(item);
		else result.gathered.push(item);
		return;
	}
	if (!session.video) throw new Error('Video reference has no independent snapshot input proof.');
	session.sidecar ??= videoSidecar(session.directory);
	const { item, pointer } = await gatheredReference(
		{ sidecar: session.sidecar, line, recordPath: session.recordPath, limits: session.limits },
		session.video
	);
	result.gathered.push(item);
	result.videoBatches ??= [];
	if (!result.videoBatches.some((p) => p.batch === pointer.batch))
		result.videoBatches.push(pointer);
}
function parsedLine(text: string) {
	try {
		const parsed = captureLineSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

async function gatheredReference(
	input: {
		sidecar: GatherVideoSidecar;
		line: ReturnType<typeof captureLineSchema.parse>;
		recordPath: string;
		limits: CaptureLimits;
	},
	context: VideoGatherContext
) {
	const capture = sidecarCapture(input.sidecar, input.line, input.recordPath);
	const slot = currentReference(capture, context, input.limits);
	const fresh = !capture.videoReference!.record;
	const service =
		context.references?.(fresh) ??
		new VideoReferenceService(context.repository, fresh ? undefined : context.pinned);
	const verified = await service.resolve({
		source: context.source,
		capture,
		batches: input.sidecar.batches
	});
	if (verified.inputHash !== slot.inputHash)
		throw new Error('Resolved clip input proof differs from current snapshot.');
	const bytes = verified.files.get(capture.path);
	if (!bytes) throw new Error('Resolved video has no canonical media.');
	const facts = mediaFacts(bytes, capture.mediaType);
	if (!('kind' in facts) || facts.kind !== 'video')
		throw new Error('Resolved video is not decodable.');
	const item: Gathered = { line: input.line, capture, facts };
	admitVideoReference(item, context.source.commit, verified.inputHash);
	return { item, pointer: verified.pointer };
}

function currentReference(capture: Capture, context: VideoGatherContext, limits: CaptureLimits) {
	const video = capture.video;
	if (capture.kind !== 'video' || !video)
		throw new Error('Only video captures may name a child batch.');
	const slot = context.slots.find(
		(s) => s.unit === video.unit && s.clipId === video.clipId && s.viewport === capture.viewport
	);
	if (slot?.inputHash !== video.inputHash)
		throw new Error('Referenced clip does not match current snapshot inputs.');
	const refusal =
		oversizeCapture(capture.path, capture.bytes, limits) ??
		oversizeCapture(video.poster.file, video.poster.bytes, limits);
	if (refusal) throw new Error(refusal);
	return slot;
}
