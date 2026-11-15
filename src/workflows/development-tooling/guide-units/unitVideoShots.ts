// @harness-uid u_hf3mh6nbh4
import type { ScenarioManifest } from '../../../core/development-tooling/unitTypes';
import type { ExplorerCapture } from '../../../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import { videoCaptureSchema } from '../../../utils/verification-evidence/videoClipSchema';
import type {
	VideoClip,
	VideoCapture,
	VideoManifest
} from '../../../utils/verification-evidence/videoClipSchema.types';
import type { UnitShots } from './unitShots.types';
import { unitStateName } from './contractStates';

/** A screenshot cannot complete a state whose explicit clip obligations are still missing. */
export function unitVideoShots(
	captures: ExplorerCapture[],
	scenarios: ScenarioManifest[],
	entity: string
): UnitShots {
	const discovery = scenarios.flatMap(
		(scenario) =>
			scenario.video?.discoveryGaps
				?.filter((gap) => gap.unit === entity)
				.map((gap) => gap.reason) ?? []
	);
	const missing = new Set<string>(),
		slots: string[] = [];
	for (const scenario of scenarios) {
		for (const clip of scenario.video?.clips.filter((clip) => clip.unit === entity) ?? [])
			for (const viewport of clip.viewports) {
				if (captures.some((item) => admittedVideo(item, scenario, clip, viewport))) continue;
				missing.add(slotKey(unitStateName(entity, clip.state), viewport));
				slots.push(`${scenario.id}/${clip.id}/${viewport}`);
			}
	}
	return {
		captures: discovery.length ? [] : captures.filter((item) => !blocked(item, entity, missing)),
		gap:
			[
				slots.length
					? `Missing required video evidence: ${slots.join(', ')}. Page graph completeness remains a verification obligation.`
					: '',
				discovery.length ? `Page inventory pending: ${discovery.join(' ')}` : ''
			]
				.filter(Boolean)
				.join(' ') || null
	};
}

function admittedVideo(
	item: ExplorerCapture,
	scenario: ScenarioManifest,
	clip: VideoClip,
	viewport: string
): boolean {
	if (!captureForSlot(item, scenario.id, clip, viewport)) return false;
	const raw: unknown = 'video' in item.capture ? item.capture.video : undefined;
	const parsed = videoCaptureSchema.safeParse(raw),
		duration = item.capture.durationSeconds;
	if (!parsed.success || !validDuration(duration, clip.durationSeconds)) return false;
	const video = parsed.data,
		size = scenario.video!.viewports.find((item) => item.id === viewport)!;
	return (
		videoIdentity(video, clip) &&
		checkpointProved(video, clip, viewport) &&
		videoSize(video, size) &&
		visitsComplete(clip.states, video.states, duration!) &&
		visitsComplete(clip.edges, video.edges, duration!)
	);
}

function captureForSlot(
	item: ExplorerCapture,
	scenario: string,
	clip: VideoClip,
	viewport: string
): boolean {
	return (
		item.usable &&
		item.capture.status === 'passed' &&
		item.capture.kind === 'video' &&
		item.capture.provenance === 'actual-capture' &&
		item.scenario === scenario &&
		item.capture.viewport === viewport &&
		unitStateName(clip.unit, item.state) === unitStateName(clip.unit, clip.state)
	);
}

function videoIdentity(video: VideoCapture, clip: VideoClip): boolean {
	return (
		video.clipId === clip.id &&
		video.unit === clip.unit &&
		video.entry === clip.entry &&
		video.exit === clip.exit
	);
}

function checkpointProved(video: VideoCapture, clip: VideoClip, viewport: string): boolean {
	if (!clip.checkpoints) return true;
	const point = clip.checkpoints.find((point) => point.viewport === viewport);
	return Boolean(
		point &&
		point.entrySignature === video.entrySignature &&
		point.exitSignature === video.exitSignature
	);
}

function videoSize(video: VideoCapture, size: VideoManifest['viewports'][number]): boolean {
	return (
		video.width === size.width * (size.scale ?? 1) &&
		video.height === size.height * (size.scale ?? 1)
	);
}

function validDuration(duration: number | undefined, maximum: number): boolean {
	return (
		typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= maximum
	);
}

function visitsComplete(
	ids: string[],
	visits: { id: string; atSeconds: number }[],
	duration: number
): boolean {
	return ids.every((id) =>
		visits.some((visit) => visit.id === id && visit.atSeconds >= 0 && visit.atSeconds <= duration)
	);
}

function slotKey(state: string, viewport: string): string {
	return `${state}\0${viewport}`;
}

function blocked(item: ExplorerCapture, entity: string, missing: Set<string>): boolean {
	const prefix = `${unitStateName(entity, item.state)}\0`;
	return item.capture.viewport
		? missing.has(prefix + item.capture.viewport)
		: [...missing].some((slot) => slot.startsWith(prefix));
}
