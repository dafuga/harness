<script lang="ts">
	import type { LiveActivity, ProjectActivity } from '../../../../../../src/core/activityTypes';
	import ActivityAgents from '../activity-agents/ActivityAgents.svelte';
	import ActivityFiles from '../ActivityFiles.svelte';
	import ActivityLoops from '../ActivityLoops.svelte';
	import ActivityWork from '../ActivityWork.svelte';
	import { commitHref } from './activityDisplay';
	let {
		activity,
		live,
		base,
		reading
	}: {
		activity: ProjectActivity;
		/** What a running Harness reads now; null for a recorded history. */
		live: LiveActivity | null;
		/** Where the console of this repository is served. */
		base: string;
		/** How an open page reads again; absent where what is shown is read once. */
		reading?: { now: number; failed: boolean; refresh: () => void };
	} = $props();
	let recorded = $derived(activity.kind === 'recorded');
	let registry = $derived(
		recorded
			? 'commit ' + (activity.asOf?.commit.slice(0, 7) ?? 'none')
			: 'this checkout as it is now'
	);
	let reach = $derived(new Map(activity.work.map((item) => [item.commit, item.branches])));
	/** The page of a commit, on the branch the repository is on when that branch holds it. */
	function href(commit: string): string {
		const branches = reach.get(commit) ?? [];
		const own = activity.repository.branch;
		return commitHref(base, commit, own && branches.includes(own) ? [own] : branches);
	}
</script>

<div class="project-activity">
	<p class="pa-note pa-identity" aria-label="Repository">
		Repository <strong>{activity.repository.name}</strong> · branch
		{activity.repository.branch ?? 'none'} · {activity.repository.head?.slice(0, 7) ?? 'no commit'}
	</p>
	<ActivityAgents agents={live?.agents ?? null} sampledAt={live?.sampledAt} {reading} />
	<ActivityFiles files={activity.files} worktrees={live?.worktrees ?? null} {href} {registry} />
	<ActivityWork work={activity.work} {href} {recorded} />
	<ActivityLoops loops={activity.loops} />
</div>

<style>
	.project-activity {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		margin: 0 0 28px;
	}
	.pa-identity {
		grid-column: 1 / -1;
		margin: 0;
	}
	.project-activity :global(.pa-card) {
		min-width: 0;
		padding: 18px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--panel);
	}
	.project-activity :global(.pa-head),
	.project-activity :global(.pa-row) {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px 12px;
	}
	/* In a row the name takes the room and wraps; what follows it keeps its line. */
	.project-activity :global(.pa-row) {
		flex-wrap: nowrap;
	}
	.project-activity :global(.pa-row > :first-child) {
		flex: 1;
		min-width: 0;
	}
	.project-activity :global(.pa-row > :last-child:not(:first-child)) {
		flex: none;
	}
	.project-activity :global(h2) {
		margin: 0;
		font-size: 1.05rem;
	}
	.project-activity :global(h3) {
		margin: 14px 0 0;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.project-activity :global(.pa-list) {
		display: grid;
		gap: 10px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}
	.project-activity :global(.pa-list li[hidden]) {
		display: none;
	}
	.project-activity :global(.pa-more) {
		min-height: 36px;
		margin-top: 10px;
		padding: 4px 12px;
		font-size: 0.82rem;
	}
	.project-activity :global(.pa-head .pa-more) {
		margin: 0 0 0 8px;
	}
	.project-activity :global(.pa-detail summary) {
		color: var(--gold);
		font-size: 0.82rem;
		cursor: pointer;
	}
	.project-activity :global(.pa-detail > *) {
		margin-top: 6px;
	}
	.project-activity :global(.pa-warn) {
		margin: 10px 0 0;
		padding: 8px 12px;
		border-left: 3px solid #edc27b;
		color: #edc27b;
		font-size: 0.86rem;
	}
	.project-activity :global(.pa-list li:not([hidden])) {
		display: grid;
		gap: 4px;
		min-width: 0;
		padding-top: 10px;
		border-top: 1px solid var(--line);
		overflow-wrap: anywhere;
	}
	.project-activity :global(.pa-meta),
	.project-activity :global(.pa-tags) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin: 0;
	}
	.project-activity :global(.pa-meta),
	.project-activity :global(.pa-note),
	.project-activity :global(.pa-empty),
	.project-activity :global(small) {
		color: var(--muted);
		font-size: 0.82rem;
	}
	.project-activity :global(.pa-chip) {
		padding: 1px 8px;
		border: 1px solid var(--line);
		border-radius: 999px;
		font-size: 0.78rem;
	}
	.project-activity :global(.pa-chip em),
	.project-activity :global(.pa-state.stale),
	.project-activity :global(.pa-state.gone),
	.project-activity :global(.pa-state.failed) {
		color: #edc27b;
	}
	.project-activity :global(.pa-state.working),
	.project-activity :global(a) {
		color: var(--gold);
	}
	.project-activity :global(.pa-count) {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin: 10px 0 0;
	}
	.project-activity :global(.pa-count strong) {
		font-size: 2rem;
	}
	.project-activity :global(.pa-reason) {
		margin: 0;
	}
	.project-activity :global(.pa-reason span) {
		color: var(--muted);
	}
	.project-activity :global(code) {
		font-size: 0.85rem;
	}
	@media (max-width: 920px) {
		.project-activity {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/* On a phone the parts are tighter, so that what comes second is not far down. */
	@media (max-width: 520px) {
		.project-activity {
			gap: 12px;
		}
		.project-activity :global(.pa-card) {
			padding: 14px;
		}
		.project-activity :global(.pa-list) {
			gap: 6px;
			margin-top: 8px;
		}
		.project-activity :global(.pa-list li:not([hidden])) {
			padding-top: 8px;
		}
	}
</style>
