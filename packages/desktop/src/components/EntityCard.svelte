<script lang="ts">
	import type { CatalogEntity } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { imageUrl } from '../utils/imageUrl';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	let { entity, workspace }: { entity: CatalogEntity; workspace: Workspace } = $props();
	let image = $state('');
	$effect(() => {
		const thumb = entity.thumbnail;
		const request = thumb && { entityId: entity.id, version: thumb.version, sha256: thumb.sha256 };
		return imageUrl(workspace, request, (url) => (image = url));
	});
</script>

<article class="entity-card" class:planned={entity.hasPlan}>
	<div class="row">
		<h2>{entity.title}</h2>
		{#if entity.hasPlan}<PlanBadge />{/if}
	</div>
	<p>{entity.summary}</p>
	<div class="thumbnail">
		{#if image}<img
				src={image}
				alt={`${entity.title} design ${entity.thumbnail?.version}`}
			/>{:else}<span class="muted"
				>{entity.thumbnail ? 'Design preview unavailable' : 'No design image yet'}</span
			>{/if}
	</div>
	<div class="row card-meta">
		<span>{entity.latestVersion || entity.kind}</span><StatusIcon
			status={entity.verification}
			reason={entity.verificationNote}
		/>
	</div>
	<WorkspaceLink {workspace} to={workspace.path(entity.category, entity.id)} class="outline gold"
		>{entity.hasPlan ? 'Review designs' : 'Open ' + entity.kind} <span>→</span></WorkspaceLink
	>
</article>
