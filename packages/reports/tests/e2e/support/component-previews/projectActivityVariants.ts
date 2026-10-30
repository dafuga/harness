import type { PreviewCases } from './shared';
import type { LiveActivity, ProjectActivity } from '../../../../../../src/core/activityTypes';
import { noop } from './shared';

/** Show an empty repository or retain a live observation that fails or grows stale. */
export function projectActivityVariant(props: PreviewCases[string], variant: string) {
	const live = props.live as LiveActivity;
	if (variant === 'empty') {
		const activity = props.activity as ProjectActivity;
		return {
			...props,
			activity: {
				...activity,
				repository: { ...activity.repository, head: null },
				asOf: null,
				work: [],
				files: [],
				loops: { total: 0, types: [] }
			},
			live: {
				...live,
				worktrees: [],
				agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }
			}
		};
	}
	return {
		...props,
		reading: {
			now: Date.parse(live.sampledAt) + (variant === 'stale' ? 61_000 : 0),
			failed: variant === 'failed-read',
			refresh: noop
		}
	};
}
