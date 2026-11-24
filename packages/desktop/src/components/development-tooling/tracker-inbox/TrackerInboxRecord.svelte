<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_eaodnfratq -->
<script lang="ts">
	import type { InboxDetail } from '../../../models/development-tooling/TrackerInbox.types';
	import { flagQuestion } from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	let { detail }: { detail: InboxDetail } = $props();

	function runTime(stamp: number | null): string {
		return stamp === null ? '' : new Date(stamp).toLocaleString();
	}
</script>

{#if detail.flag}
	<hx-section class="flag" data-flag-state={detail.flag.state}>
		<hx-h3>{detail.flag.state === 'open' ? 'Waiting on you' : 'Flag answered'}</hx-h3>
		<hx-p>{flagQuestion(detail.flag)}</hx-p>
	</hx-section>
{/if}

<hx-section>
	<hx-h3>Runs</hx-h3>
	{#if detail.runs.length === 0}
		<hx-p class="meta">No runs are on this phone for this item.</hx-p>
	{:else}
		<hx-ul class="plain">
			{#each detail.runs as run (run.origin + run.id)}
				<hx-li>
					<hx-span class="state">{run.state}</hx-span>
					{#if run.outcome}<hx-span>· {run.outcome}</hx-span>{/if}
					<hx-span class="meta">{runTime(run.endedAt ?? run.startedAt ?? run.queuedAt)}</hx-span>
				</hx-li>
			{/each}
		</hx-ul>
	{/if}
</hx-section>

<hx-section>
	<hx-h3>Notes</hx-h3>
	{#if detail.notes.length === 0}
		<hx-p class="meta">No notes are on this phone for this item.</hx-p>
	{:else}
		<hx-ul class="plain">
			{#each detail.notes as note (note.id)}
				<hx-li>
					<hx-span class="meta">{note.author} · {note.at}</hx-span>
					<hx-p>{note.text}</hx-p>
				</hx-li>
			{/each}
		</hx-ul>
	{/if}
</hx-section>

<style>
	:global(.flag) {
		border-left: var(--hx-border-thick) solid var(--hx-color-primary);
		padding-left: var(--hx-space-8);
	}
	:global(.plain) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--hx-space-6);
	}
	:global(.meta) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		margin: 0;
	}
	:global(.state) {
		font-weight: var(--hx-style-weight-semibold);
	}
</style>
