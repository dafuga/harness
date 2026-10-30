import type { PreviewCases } from './shared';
import type { LiveActivity, ProjectActivity } from '../../../../../../src/core/activityTypes';
import { noop } from './shared';

/** Show an empty repository or retain a live observation that fails or grows stale. */
export function projectActivityVariant(props: PreviewCases[string], variant: string) {
	const live = props.live as LiveActivity;
	if (variant === 'empty')
		return { ...props, ...emptyActivity({ activity: props.activity as ProjectActivity, live }) };
	return {
		...props,
		reading: {
			now: Date.parse(live.sampledAt) + (variant === 'stale' ? 61_000 : 0),
			failed: variant === 'failed-read',
			refresh: noop
		}
	};
}

/** Feed the live site the same empty or stale snapshot before and after its first refresh. */
export function siteActivityVariant(props: PreviewCases[string], variant: string) {
	const shown = props.shown as { activity: ProjectActivity; live: LiveActivity };
	if (variant === 'empty') return { ...props, shown: emptyActivity(shown) };
	if (variant === 'stale')
		return {
			...props,
			shown: {
				...shown,
				live: {
					...shown.live,
					sampledAt: earlier(shown.live.sampledAt),
					agents: {
						...shown.live.agents,
						roster: shown.live.agents.roster.map((agent) => ({
							...agent,
							registeredAt: earlier(agent.registeredAt),
							heartbeatAt: earlier(agent.heartbeatAt),
							expiresAt: earlier(agent.expiresAt)
						}))
					}
				}
			}
		};
	return variant === 'failed-refresh' ? props : null;
}

function earlier(timestamp: string) {
	return new Date(Date.parse(timestamp) - 120_000).toISOString();
}

function emptyActivity(shown: { activity: ProjectActivity; live: LiveActivity }) {
	return {
		activity: {
			...shown.activity,
			repository: { ...shown.activity.repository, head: null },
			asOf: null,
			work: [],
			files: [],
			loops: { total: 0, types: [] }
		},
		live: {
			...shown.live,
			worktrees: [],
			agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }
		}
	};
}
