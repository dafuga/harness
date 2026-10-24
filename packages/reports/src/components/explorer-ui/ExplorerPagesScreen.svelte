<script lang="ts">
	import { entityCatalog } from '../../utils/explorer-ui/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	import ExplorerCatalogItems from '../ExplorerCatalogItems.svelte';
	let host: ExplorerScreenProps = $props();
	let rows = $derived(entityCatalog(host.entities, 'pages', host.lens.relations));
</script>

<!-- The pages of the app as cards: where a person starts, each with its own screenshot. The
	marker of the screen draws no box. -->
<div class="ex-screen" data-harness-component="harness-explorer-pages-screen">
	<ExplorerFrame {host}>
		{#snippet children(nav)}
			<ExplorerIndex
				category="pages"
				{rows}
				scope={JSON.stringify([host.route.branch, host.scope.commit])}
			>
				{#snippet list(listed)}
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
</div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
