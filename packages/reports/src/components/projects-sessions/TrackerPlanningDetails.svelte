<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_mvlweghhmy -->
<script lang="ts">
	import {
		trackerStages,
		trackerStageLabels
	} from '../../../../../src/utils/projects-sessions/trackerPlanning';
	import type {
		TrackerArtifact,
		TrackerPlanning,
		TrackerStage
	} from '../../../../../src/utils/projects-sessions/trackerPlanning.types';

	let {
		stage,
		planning,
		linkTarget = '_blank'
	}: {
		stage?: TrackerStage;
		planning?: TrackerPlanning;
		linkTarget?: '_blank' | 'tracker-artifact';
	} = $props();
</script>

{#snippet designLinks(links: TrackerArtifact['links'])}
	{#each links ?? [] as link (link)}
		<hx-p>
			{#if link.kind === 'image' || (!link.kind && /\.(?:png|webp|jpe?g|avif|gif)$/i.test(new URL(link.url).pathname))}
				<hx-img
					class="tracker-planning-image"
					src={link.url}
					alt={link.label}
					referrerpolicy="no-referrer"
					onerror={(event: Event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
				/>
			{/if}
			<hx-a
				class="tracker-planning-link"
				href={link.url}
				target={linkTarget}
				rel="noopener noreferrer">{link.label}</hx-a
			></hx-p
		>
	{/each}
{/snippet}

<hx-section
	aria-label="Planning stages"
	class="tracker-planning"
	data-harness-component="projects-sessions-tracker-planning-details"
>
	<hx-h3>Planning stages</hx-h3>
	<hx-ul class="tracker-planning-stages">
		{#each trackerStages as step (step)}
			{@const artifact = planning?.artifacts[step]}
			{@const promotion = planning?.promotions.find((entry) => entry.stage === step)}
			<hx-li aria-current={stage === step ? 'step' : undefined}>
				<hx-h4>{trackerStageLabels[step]}</hx-h4>
				{#if stage === step}
					<hx-p class="tracker-planning-meta">Current stage</hx-p>
				{/if}
				{#if promotion}
					<hx-p class="tracker-planning-meta"
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
					<hx-p class="tracker-planning-meta">No artifacts yet.</hx-p>
				{/if}
			</hx-li>
		{/each}
	</hx-ul>
</hx-section>

<style>
	:global(.tracker-planning) {
		overflow-wrap: anywhere;
	}
	:global(.tracker-planning :is(h3, h4, p)) {
		margin: var(--hx-space-4) 0;
	}
	:global(.tracker-planning-stages) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--hx-space-6);
	}
	:global(.tracker-planning-meta) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		margin: 0;
	}
	:global(.tracker-planning-image) {
		max-width: 100%;
		max-height: 45vh;
		object-fit: contain;
		vertical-align: top;
		margin-block: var(--hx-space-8);
	}
	:global(.tracker-planning-link) {
		display: block;
		text-decoration: underline;
	}
</style>
