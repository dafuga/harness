<script lang="ts">
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type { CatalogEntity } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { imageUrl } from '../utils/imageUrl';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	import RecordedPreview from './RecordedPreview.svelte';
	let { entity, workspace }: { entity: CatalogEntity; workspace: Workspace } = $props();
	let image = $state('');
	/** A function has a plan and no design: no picture is asked for it or left room for. */
	const headless = $derived(entity.category === 'functions');
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

<article class="entity-card" class:planned={entity.hasPlan}>
	<div class="row">
		<h2>{explorerName(entity)}</h2>
		{#if entity.hasPlan}<PlanBadge />{/if}
	</div>
	<p>{entity.summary}</p>
	{#if !headless}<div class="thumbnail" class:runtime={recorded !== null}>
			{#if recorded}<RecordedPreview
					{workspace}
					entityId={entity.id}
					title={explorerName(entity)}
					thumbnail={recorded}
				/>
			{:else if image}<img
					src={image}
					alt={`${entity.title} design ${entity.latestVersion ?? ''}`}
				/>{:else}<span class="muted"
					>{entity.thumbnail
						? 'Design preview unavailable'
						: entity.hasPlan
							? 'No design image yet'
							: 'No screenshot recorded'}</span
				>{/if}
		</div>{/if}
	<div class="row card-meta">
		<span>{recorded ? entity.kind : entity.latestVersion || entity.kind}</span><StatusIcon
			status={entity.verification}
			reason={entity.verificationNote}
		/>
	</div>
	<!-- A proposal is reviewed where its designs are, a function's where its plan is. -->
	<WorkspaceLink
		{workspace}
		to={workspace.path(entity.category, entity.id, entity.hasPlan ? reviewed : '')}
		class="outline gold"
		>{entity.hasPlan ? `Review ${reviewed}` : 'Open ' + entity.kind} <span>→</span></WorkspaceLink
	>
</article>

<style>
	.thumbnail.runtime {
		aspect-ratio: 16 / 11;
	}
</style>
