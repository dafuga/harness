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
		gap: var(--hx-space-16);
		margin: 0 0 var(--hx-space-28);
	}
	.pa-identity {
		grid-column: 1 / -1;
		margin: 0;
	}
	.project-activity :global(.pa-card) {
		min-width: 0;
		padding: var(--hx-space-18);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
	}
	.project-activity :global(.pa-head),
	.project-activity :global(.pa-row) {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--hx-space-6) var(--hx-space-12);
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
		font-size: var(--hx-type-size-base);
	}
	.project-activity :global(h3) {
		margin: var(--hx-space-14) 0 0;
		font-size: var(--hx-type-size-compact);
		letter-spacing: var(--hx-style-tracking-caps);
		text-transform: uppercase;
		color: var(--hx-color-primary);
	}
	.project-activity :global(.pa-list) {
		display: grid;
		gap: var(--hx-space-10);
		margin: var(--hx-space-12) 0 0;
		padding: 0;
		list-style: none;
	}
	.project-activity :global(.pa-list li[hidden]) {
		display: none;
	}
	.project-activity :global(.pa-more) {
		min-height: 36px;
		margin-top: var(--hx-space-10);
		padding: var(--hx-space-4) var(--hx-space-12);
		font-size: var(--hx-type-size-compact);
	}
	.project-activity :global(.pa-head .pa-more) {
		margin: 0 0 0 var(--hx-space-8);
	}
	.project-activity :global(.pa-detail summary) {
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-compact);
		cursor: pointer;
	}
	.project-activity :global(.pa-detail > *) {
		margin-top: var(--hx-space-6);
	}
	.project-activity :global(.pa-warn) {
		margin: var(--hx-space-10) 0 0;
		padding: var(--hx-space-8) var(--hx-space-12);
		border-left: var(--hx-border-heavy) solid var(--hx-color-warning);
		color: var(--hx-color-warning);
		font-size: var(--hx-type-size-sm);
	}
	.project-activity :global(.pa-list li:not([hidden])) {
		display: grid;
		gap: var(--hx-space-4);
		min-width: 0;
		padding-top: var(--hx-space-10);
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
		overflow-wrap: anywhere;
	}
	.project-activity :global(.pa-meta),
	.project-activity :global(.pa-tags) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-4) var(--hx-space-12);
		margin: 0;
	}
	.project-activity :global(.pa-meta),
	.project-activity :global(.pa-note),
	.project-activity :global(.pa-empty),
	.project-activity :global(small) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-compact);
	}
	.project-activity :global(.pa-chip) {
		padding: var(--hx-space-1) var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-pill);
		font-size: var(--hx-type-size-xs);
	}
	.project-activity :global(.pa-chip em),
	.project-activity :global(.pa-state.stale),
	.project-activity :global(.pa-state.gone),
	.project-activity :global(.pa-state.failed) {
		color: var(--hx-color-warning);
	}
	.project-activity :global(.pa-state.working),
	.project-activity :global(a) {
		color: var(--hx-color-primary);
	}
	.project-activity :global(.pa-count) {
		display: flex;
		align-items: baseline;
		gap: var(--hx-space-12);
		margin: var(--hx-space-10) 0 0;
	}
	.project-activity :global(.pa-count strong) {
		font-size: var(--hx-type-size-3xl);
	}
	.project-activity :global(.pa-reason) {
		margin: 0;
	}
	.project-activity :global(.pa-reason span) {
		color: var(--hx-color-text-muted);
	}
	.project-activity :global(code) {
		font-size: var(--hx-type-size-sm);
	}
	@media (max-width: 920px) {
		.project-activity {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/* On a phone the parts are tighter, so that what comes second is not far down. */
	@media (max-width: 520px) {
		.project-activity {
			gap: var(--hx-space-12);
		}
		.project-activity :global(.pa-card) {
			padding: var(--hx-space-14);
		}
		.project-activity :global(.pa-list) {
			gap: var(--hx-space-6);
			margin-top: var(--hx-space-8);
		}
		.project-activity :global(.pa-list li:not([hidden])) {
			padding-top: var(--hx-space-8);
		}
	}
</style>
