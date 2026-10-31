<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import { entityCatalog } from '../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerCatalogItems from './ExplorerCatalogItems.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(
		entityCatalog(host.entities, category, host.lens.relations, { revision: host.head })
	);
</script>

<!-- The catalog of one kind; the marker of the screen draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-explorer-catalog-screen">
	<ExplorerFrame {host}>
		{#snippet children(nav: EntityNav)}
			<ExplorerIndex
				{category}
				{rows}
				scope={JSON.stringify([host.route.branch, host.scope.commit])}
			>
				{#snippet list(listed: CatalogRow[])}
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
</hx-div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
