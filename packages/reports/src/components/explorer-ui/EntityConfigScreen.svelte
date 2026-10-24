<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import EntityConfig from './EntityConfig.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntitySections from './entity-sections/EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- What is set: a config opens on what it provides and who uses it; it is not seen or run. The
	marker of the screen draws no box. -->
<div class="ex-screen" data-harness-component="harness-entity-config-screen">
	<EntityFrame {host}>
		{#snippet children(entity, nav)}
			<EntitySections {host} {entity} {nav}>
				{#snippet pane()}
					{#if entity.category === 'configs'}<EntityConfig {entity} scope={host.scope} {nav} />{/if}
				{/snippet}
			</EntitySections>
		{/snippet}
	</EntityFrame>
</div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
