<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import EntityFrame from './EntityFrame.svelte';
	import EntityHistory from './entity-history/EntityHistory.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- The history of an entity of any kind, through the shown commit. The marker of the screen
	draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-entity-history-screen">
	<EntityFrame {host}>
		{#snippet children(entity, nav)}
			<!-- A history belongs to one entity at one commit; another one starts from nothing read. -->
			{#key entity.id + host.scope.commit}
				<EntityHistory
					{entity}
					rows={host.lens.history(entity.id)}
					index={host.index}
					scope={host.scope}
					known={host.parent ? [host.head, host.parent] : [host.head]}
					client={host.client}
					{nav}
				/>
			{/key}
		{/snippet}
	</EntityFrame>
</hx-div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
