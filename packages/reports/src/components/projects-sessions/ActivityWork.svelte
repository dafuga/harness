<script lang="ts">
	import type { WorkItem } from '../../../../../src/core/activityTypes';
	import { activityTime } from '../../utils/projects-sessions/activityDisplay';
	import { plural } from '../../helpers/strings/plural';
	import ActivityList from './ActivityList.svelte';
	let {
		work,
		href,
		recorded = false
	}: {
		work: WorkItem[];
		href: (commit: string) => string;
		/** True for a built history, whose reasons include those its records accepted. */
		recorded?: boolean;
	} = $props();
</script>

{#snippet commitRow(item: WorkItem)}
	<div class="pa-row">
		<strong>{item.subject}</strong>
		<a href={href(item.commit)} title={'The page of commit ' + item.commit}
			>{item.commit.slice(0, 7)}</a
		>
	</div>
	<div class="pa-meta">
		<time datetime={item.committedAt}>{activityTime(item.committedAt)} UTC</time>
		<span>{item.branches.length ? item.branches.join(', ') : 'on no branch'}</span>
		<span>{plural(item.files, 'file')}</span>
		<span>{plural(item.unitCount ?? item.units.length, 'component')}</span>
		<span>{plural(item.reasonCount, 'reason')}</span>
	</div>
	{#if item.units.length || item.reasons.length}
		<details class="pa-detail">
			<summary>Components and reasons</summary>
			<div class="pa-tags">
				{#each item.units as unit (unit)}<span class="pa-chip">{unit}</span>{/each}
				{#if item.unitCount > item.units.length}
					<span class="pa-note"
						>{item.unitCount - item.units.length} more components are on its page.</span
					>
				{/if}
			</div>
			{#if item.reasons.length}
				<p class="pa-note">
					{recorded ? 'Noted on this commit or accepted by its records' : 'Noted on this commit'}:
				</p>
			{/if}
			{#each item.reasons as reason, position (position)}
				<p class="pa-reason"><span>{reason.unit}</span> {reason.behavior}</p>
			{/each}
			{#if item.reasonCount > item.reasons.length}
				<small>{item.reasonCount - item.reasons.length} more reasons are on its page.</small>
			{/if}
		</details>
	{/if}
	{#if item.reasonCount === 0}<small>No reason is noted on this commit.</small>{/if}
{/snippet}

<section class="pa-card" aria-label="Recent work">
	<div class="pa-head">
		<h2>Recent work</h2>
		<span class="pa-note">Committed · from Git</span>
	</div>
	{#if work.length}
		<ActivityList
			items={work}
			label="Recent commits"
			noun="commits"
			preview={5}
			ordered
			row={commitRow}
		/>
	{:else}
		<p class="pa-empty">No commit is in this history yet.</p>
	{/if}
</section>
