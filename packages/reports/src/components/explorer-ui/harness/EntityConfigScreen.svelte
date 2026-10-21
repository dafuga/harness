<script lang="ts">
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import EntityConfig from './EntityConfig.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntitySections from './entity-sections/EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- What is set: a config opens on what it provides and who uses it; it is not seen or run. -->
<EntityFrame {host}>
	{#snippet children(entity, nav)}
		<EntitySections {host} {entity} {nav}>
			{#snippet pane()}
				{#if entity.category !== 'models'}<EntityConfig {entity} scope={host.scope} {nav} />{/if}
			{/snippet}
		</EntitySections>
	{/snippet}
</EntityFrame>
