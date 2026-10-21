<script lang="ts">
	import { entityCatalog } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import ExplorerCatalogItems from '../ExplorerCatalogItems.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(entityCatalog(host.entities, category, host.lens.relations));
</script>

<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex {category} {rows}>
			{#snippet list(listed)}
				<ExplorerCatalogItems
					{category}
					rows={listed}
					{nav}
					lens={host.lens}
					mediaBase={host.mediaBase}
				/>
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>
