import { displayTime as sharedDisplayTime } from '$reports/helpers/strings/formatTime';
import type { ProjectSnapshot } from '../../models/Desktop.types';
export function revisionTime(
	snapshot: ProjectSnapshot | null,
	kind: 'commit' | 'branch'
): string | null {
	const hash = kind === 'branch' ? snapshot?.revision.tip : snapshot?.revision.commit;
	const commit = snapshot?.commits.find((item) => item.hash === hash);
	return commit?.committedAt ?? commit?.authoredAt ?? null;
}
export function displayTime(value: string | null): string {
	return sharedDisplayTime(value);
}
