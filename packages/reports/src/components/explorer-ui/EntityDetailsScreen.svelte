<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { entityShown } from './entity-sections/entityShown';
	import EntityDetails from './EntityDetails.svelte';
	import EntityFrame from './EntityFrame.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- The details of an entity of any kind: contract, measurements, and the source on request. The
	marker of the screen draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-entity-details-screen">
	<EntityFrame {host}>
		{#snippet children(entity, nav)}
			{@const summary = entityShown(host, entity)}
			<EntityDetails
				{entity}
				{nav}
				repository={host.index.sourceRepository}
				commit={entity.lastAt ?? host.scope.commit}
				contract={summary.contract}
				measure={summary.measure}
				record={summary.record}
				tab={host.route.tab}
			/>
		{/snippet}
	</EntityFrame>
</hx-div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
