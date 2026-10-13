<script lang="ts">
	import ImageThumbnail from './ImageThumbnail.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { EntityDetail } from '../models/Desktop.types';
	let {
		entity,
		workspace,
		version,
		select
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		version: string;
		select: (version: string) => void;
	} = $props();
	/** A function has plans and no design: no picture of a version is asked for. */
	const headless = $derived(entity.category === 'functions');
</script>

<details class="thread-history">
	<summary>{entity.kind} history</summary>{#each entity.history as event (event.id)}<article>
			<strong>{event.title}</strong><small>{event.at}</small>
			<p>{event.detail}</p>
		</article>{:else}<p class="muted">No entity history recorded.</p>{/each}
</details>
<div class="version-strip" aria-label="Entity image versions">
	{#each entity.versions as item (item.version)}<button
			class:active={version === item.version}
			onclick={() => select(item.version)}
			>{#if item.images[0] && !headless}<ImageThumbnail
					{workspace}
					entityId={entity.id}
					version={item.version}
					sha256={item.images[0].sha256}
					title={`${entity.title} ${item.version}`}
				/>{/if}{item.version}<small
				>{item.approval ? 'Approved' : headless ? 'Plan' : 'Design'}</small
			></button
		>{/each}
</div>
