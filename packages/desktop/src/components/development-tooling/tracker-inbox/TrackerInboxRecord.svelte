<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_eaodnfratq -->
<script lang="ts">
	import type { InboxDetail } from '../../../models/development-tooling/TrackerInbox.types';
	import type { TrackerArtifact } from '../../../../../../src/utils/projects-sessions/trackerPlanning.types';
	import { trackerStages } from '../../../../../../src/utils/projects-sessions/trackerPlanning';
	import {
		flagQuestion,
		trackerStageLabels
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	let { detail, mode = 'phone' }: { detail: InboxDetail; mode?: 'phone' | 'mac' } = $props();

	function runTime(stamp: number | null): string {
		return stamp === null ? '' : new Date(stamp).toLocaleString();
	}
</script>

{#snippet designLinks(links: TrackerArtifact['links'])}
	{#each links ?? [] as link (link)}
		<hx-p
			><hx-a
				class="artifact-link"
				href={link.url}
				target={mode === 'mac' ? 'tracker-artifact' : '_blank'}
				rel="noopener noreferrer">{link.label}</hx-a
			></hx-p
		>
	{/each}
{/snippet}

<hx-section aria-label="Planning stages">
	<hx-h3>Planning stages</hx-h3>
	<hx-ul class="plain">
		{#each trackerStages as stage (stage)}
			{@const artifact = detail.planning?.artifacts[stage]}
			{@const promotion = detail.planning?.promotions.find((entry) => entry.stage === stage)}
			<hx-li aria-current={(detail.header.stage ?? 'idea') === stage ? 'step' : undefined}>
				<hx-h4>{trackerStageLabels[stage]}</hx-h4>
				{#if (detail.header.stage ?? 'idea') === stage}
					<hx-p class="meta">Current stage</hx-p>
				{/if}
				{#if promotion}
					<hx-p class="meta"
						>Promoted by {promotion.by} · {new Date(promotion.at).toLocaleString()}</hx-p
					>
				{/if}
				{#if artifact}
					{#if artifact.summary}<hx-p>{artifact.summary}</hx-p>{/if}
					{@render designLinks(artifact.links)}
					{#each artifact.pages ?? [] as page (page)}
						<hx-p><hx-strong>{page.name}</hx-strong></hx-p>
						{#each Object.entries(page.states ?? {}) as [state, description] (state)}
							<hx-p><hx-strong>{state}</hx-strong> · {description}</hx-p>
						{/each}
						{@render designLinks(page.links)}
					{/each}
				{:else}
					<hx-p class="meta">No artifacts yet.</hx-p>
				{/if}
			</hx-li>
		{/each}
	</hx-ul>
</hx-section>

{#if detail.flag}
	<hx-section class="flag" data-flag-state={detail.flag.state}>
		<hx-h3>{detail.flag.state === 'open' ? 'Waiting on you' : 'Flag answered'}</hx-h3>
		<hx-p>{flagQuestion(detail.flag)}</hx-p>
	</hx-section>
{/if}

<hx-section>
	<hx-h3>Runs</hx-h3>
	{#if detail.runs.length === 0}
		<hx-p class="meta"
			>{mode === 'mac'
				? 'No runs recorded for this item.'
				: 'No runs are on this phone for this item.'}</hx-p
		>
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
		<hx-p class="meta"
			>{mode === 'mac'
				? 'No notes recorded for this item.'
				: 'No notes are on this phone for this item.'}</hx-p
		>
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
	:global(.detail .artifact-link) {
		text-decoration: underline;
	}
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
