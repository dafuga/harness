<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_n5rcsahfa7 -->
<script lang="ts">
	import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import { entityCatalog } from '../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	import ExplorerCatalogItems from './ExplorerCatalogItems.svelte';
	let host: ExplorerScreenProps = $props();
	let rows = $derived(entityCatalog(host.entities, 'pages', host.lens.relations));
</script>

<!-- The pages of the app as cards: where a person starts, each with its own screenshot. The
	marker of the screen draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-explorer-pages-screen">
	<ExplorerFrame {host}>
		{#snippet children(nav: EntityNav)}
			<ExplorerIndex
				category="pages"
				{rows}
				scope={JSON.stringify([host.route.branch, host.scope.commit])}
			>
				{#snippet list(listed: CatalogRow[])}
					<ExplorerCatalogItems
						category="pages"
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
