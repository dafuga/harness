<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { explorerName } from '../../../../reports/src/utils/explorerName';
	import type { CatalogEntity } from '../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { imageUrl } from '../../utils/development-tooling/imageUrl';
	import PlanBadge from '../planning-collaboration/PlanBadge.svelte';
	import StatusIcon from '../shared-primitives/StatusIcon.svelte';
	import WorkspaceLink from '../projects-sessions/WorkspaceLink.svelte';
	import RecordedPreview from '../shared-primitives/recorded-preview/RecordedPreview.svelte';
	let { entity, workspace }: { entity: CatalogEntity; workspace: Workspace } = $props();
	let image = $state('');
	/** A function has a plan and no design: no picture is asked for it or left room for. */
	const headless = $derived(entity.category === 'functions');
	const compact = $derived(entity.category === 'pages');
	const reviewed = $derived(headless ? 'plan' : 'designs');
	const recorded = $derived(entity.thumbnail?.source === 'recorded' ? entity.thumbnail : null);
	$effect(() => {
		const thumb = headless ? null : entity.thumbnail;
		const request =
			thumb && thumb.source !== 'recorded'
				? { entityId: entity.id, version: thumb.version, sha256: thumb.sha256 }
				: null;
		return imageUrl(workspace, request, (url) => (image = url));
	});
</script>

{#snippet thumbnail(minimal = false)}
	<hx-div class="thumbnail" class:runtime={recorded !== null}>
		{#if recorded}
			<RecordedPreview
				{workspace}
				entityId={entity.id}
				title={explorerName(entity)}
				thumbnail={recorded}
				compact={minimal}
			/>
		{:else if image}
			<hx-img src={image} alt={`${entity.title} design ${entity.latestVersion ?? ''}`} />
		{:else}
			<hx-span class="muted"
				>{entity.thumbnail
					? 'Design preview unavailable'
					: entity.hasPlan
						? 'No design image yet'
						: 'No screenshot recorded'}</hx-span
			>
		{/if}
	</hx-div>
{/snippet}

<hx-article class="entity-card" class:planned={entity.hasPlan}>
	{#if headless && !entity.hasPlan}
		<WorkspaceLink
			{workspace}
			to={workspace.path(entity.category, entity.id)}
			class="helper-card-link"
			label={`Open ${entity.title}`}><hx-code>{entity.title}</hx-code></WorkspaceLink
		>
	{:else if compact}
		<WorkspaceLink
			{workspace}
			to={workspace.path(entity.category, entity.id, entity.hasPlan ? reviewed : '')}
			class="page-card-link"
			label={`Open ${explorerName(entity)}`}
		>
			<hx-h2>{explorerName(entity)}</hx-h2>
			{@render thumbnail(true)}
		</WorkspaceLink>
	{:else}
		<hx-div class="row">
			<hx-h2>{explorerName(entity)}</hx-h2>
			{#if entity.hasPlan}<PlanBadge />{/if}
		</hx-div>
		<hx-p>{entity.summary}</hx-p>
		{#if !headless}{@render thumbnail()}{/if}
		<hx-div class="row card-meta">
			<hx-span>{recorded ? entity.kind : entity.latestVersion || entity.kind}</hx-span><StatusIcon
				status={entity.verification}
				reason={entity.verificationNote}
			/>
		</hx-div>
		<!-- A proposal is reviewed where its designs are, a function's where its plan is. -->
		<WorkspaceLink
			{workspace}
			to={workspace.path(entity.category, entity.id, entity.hasPlan ? reviewed : '')}
			class="outline gold"
			>{entity.hasPlan ? `Review ${reviewed}` : 'Open ' + entity.kind}
			<hx-span>→</hx-span></WorkspaceLink
		>
	{/if}
</hx-article>

<style>
	:global(.entity-card .helper-card-link) {
		display: block;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	:global(.entity-card .helper-card-link:focus-visible) {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-space-6);
	}

	:global(.entity-card .page-card-link) {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
	}
	:global(.entity-card .page-card-link:focus-visible) {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-space-6);
	}
	.thumbnail.runtime {
		aspect-ratio: 16 / 11;
	}
</style>
