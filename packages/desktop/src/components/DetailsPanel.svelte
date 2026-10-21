<script lang="ts">
	import EntitySourceAction from './EntitySourceAction.svelte';
	import type { EntityDetail } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { entity, workspace, title }: { entity: EntityDetail; workspace: Workspace; title: string } =
		$props();
</script>

<section class="panel">
	<h2>Source files</h2>
	{#if entity.sources.length}
		<ul>
			{#each entity.sources as path (path)}<li><code>{path}</code></li>{/each}
		</ul>
	{:else}<p class="muted">This entity owns no source files.</p>{/if}
	<EntitySourceAction {entity} {workspace} {title} />
</section>
