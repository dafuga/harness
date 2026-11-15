// @harness-uid u_x7kddegtw2
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type {
	PendingVideoFlags,
	VideoFrameFlagIdentity
} from '../../../../utils/verification-evidence/scenarioCoverage.types';
import { readFrameFlags } from '../../../../services/verification-evidence/frame-flag-service/flagStore';
import { ExpectedCliError } from '../../../../core/development-tooling/errors';

/** The export has no Git metadata: reviewer requirements come only from its original repository. */
export async function snapshotVideoFlags(
	root: string,
	scenarios: ScenarioManifest[]
): Promise<Record<string, PendingVideoFlags>> {
	if (!scenarios.some((scenario) => scenario.video)) return {};
	const flags = await readFrameFlags(root),
		requirements: Record<string, PendingVideoFlags> = {};
	for (const scenario of scenarios.filter((scenario) => scenario.video)) {
		const enrolled = flags.filter((flag) =>
			scenario.video!.clips.some(
				(clip) =>
					clip.unit === flag.clip.unit &&
					clip.id === flag.clip.clipId &&
					clip.viewports.includes(flag.clip.viewport)
			)
		);
		const known = enrolled.map((flag) => ({
			id: flag.id,
			unit: flag.clip.unit,
			clipId: flag.clip.clipId,
			viewport: flag.clip.viewport,
			createdAt: flag.createdAt
		}));
		const pending = enrolled
			.filter((flag) => flag.status !== 'resolved')
			.map((flag) => ({ ...known.find((item) => item.id === flag.id)!, note: flag.note }));
		requirements[scenario.id] = { known, pending };
	}
	pendingVideoEnvironment({}, requirements);
	return requirements;
}
/** Only finite pending IDs and notes reach capture scripts; known resolved IDs stay in the judge. */
export function pendingVideoEnvironment(
	env: Record<string, string | undefined>,
	requirements: Record<string, PendingVideoFlags>
): Record<string, string | undefined> {
	if (!Object.keys(requirements).length) return env;
	const slots: (Pick<VideoFrameFlagIdentity, 'unit' | 'clipId' | 'viewport'> & {
		flags: { id: string; note: string }[];
	})[] = [];
	const pending = new Map(
		Object.values(requirements)
			.flatMap((item) => item.pending)
			.map((flag) => [flag.id, flag])
	);
	for (const flag of pending.values()) {
		let slot = slots.find((item) => sameVideoFlagSlot(item, flag));
		if (!slot) {
			slot = { unit: flag.unit, clipId: flag.clipId, viewport: flag.viewport, flags: [] };
			slots.push(slot);
		}
		slot.flags.push({ id: flag.id, note: flag.note });
		if (slot.flags.length > 256)
			throw new ExpectedCliError(
				'A video slot exceeds 256 pending frame flags; split the review before recording.'
			);
	}
	const encoded = JSON.stringify({ schemaVersion: 1, slots });
	if (Buffer.byteLength(encoded) > 60 * 1024)
		throw new ExpectedCliError(
			'Pending video flag requirements exceed the 60 KiB capture environment bound.'
		);
	return { ...env, HARNESS_PENDING_VIDEO_FLAGS: encoded };
}
function sameVideoFlagSlot(
	left: Pick<VideoFrameFlagIdentity, 'unit' | 'clipId' | 'viewport'>,
	right: VideoFrameFlagIdentity
): boolean {
	return (
		left.unit === right.unit && left.clipId === right.clipId && left.viewport === right.viewport
	);
}
