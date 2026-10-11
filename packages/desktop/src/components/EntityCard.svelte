<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CatalogEntity } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	let { entity, workspace }: { entity: CatalogEntity; workspace: Workspace } = $props();
	let image = $state('');
	$effect(() => {
		let disposed = false;
		let url = '';
		const thumb = entity.thumbnail;
		const bridge = workspace.bridge;
		const commit = workspace.snapshot?.revision.commit;
		image = '';
		if (thumb && bridge && commit)
			void bridge
				.image({ entityId: entity.id, commit, version: thumb.version, sha256: thumb.sha256 })
				.then((bytes) => {
					url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
					if (!disposed) image = url;
					else URL.revokeObjectURL(url);
				})
				.catch(() => {});
		return () => {
			disposed = true;
			if (url) URL.revokeObjectURL(url);
		};
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
	<a
		class="outline gold"
		href={resolve('/harness/[...path]', {
			path: workspace.path(entity.category, entity.id).slice(9)
		})}
		onclick={(e) => {
			e.preventDefault();
			void workspace.navigate(workspace.path(entity.category, entity.id));
		}}>{entity.hasPlan ? 'Review designs' : 'Open ' + entity.kind} <span>→</span></a
	>
</article>
