// @harness-uid u_lnqhwcablp
import type { PendingVideoFlags } from '../../../../utils/verification-evidence/scenarioCoverage.types';
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';

/** Known owner identities and every pending obligation are authoritative snapshot inputs. */
export function videoFlagCoverageFailure(
	requirements: PendingVideoFlags | undefined,
	item: Gathered
): string | undefined {
	const video = item.line.video!,
		addressed = video.addressedFlags ?? [];
	const owns = (flag: NonNullable<typeof requirements>['known'][number]) =>
		flag.unit === video.unit &&
		flag.clipId === video.clipId &&
		flag.viewport === item.line.viewport;
	const known = (requirements?.known ?? []).filter(owns),
		pending = (requirements?.pending ?? []).filter(owns);
	if (addressed.some((id) => !known.some((flag) => flag.id === id)))
		return 'addresses an unknown or wrong-owner frame flag';
	if (pending.some((flag) => !addressed.includes(flag.id)))
		return 'must explicitly address every pending frame flag';
	if (
		known.some(
			(flag) =>
				addressed.includes(flag.id) &&
				!(Date.parse(item.capture.capturedAt) > Date.parse(flag.createdAt))
		)
	)
		return 'capture predates the addressed reviewer frame flag';
	return undefined;
}
