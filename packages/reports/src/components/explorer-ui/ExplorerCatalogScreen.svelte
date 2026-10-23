<script lang="ts">
	import { entityCatalog } from '../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerCatalogItems from '../ExplorerCatalogItems.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(
		entityCatalog(host.entities, category, host.lens.relations, { revision: host.head })
	);
</script>

<!-- The catalog of one kind; the marker of the screen draws no box. -->
<div class="ex-screen" data-harness-component="harness-explorer-catalog-screen">
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
</div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
