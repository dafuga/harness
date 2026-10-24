<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { screenOptions } from '../../utils/explorer-ui/entityScreens';
	import { entityChanged } from '../../utils/explorer-ui/entityShown';
	import EntityAudio from './EntityAudio.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntityScreens from './EntityScreens.svelte';
	import EntitySections from './entity-sections/EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- Pages and shells keep recordings in Overview; components keep them in Audio beside their
	screenshots, which stay above every tab. The marker of the screen draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-entity-visual-screen">
	<EntityFrame {host}>
		{#snippet children(entity, nav)}
			<EntitySections {host} {entity} {nav}>
				{#snippet pane()}
					{@const evidence = host.lens.evidence(entity.unit)}
					{#if entity.category !== 'components'}
						<EntityScreens
							options={screenOptions(evidence.scenarios)}
							preview={entity.unit.preview}
							{evidence}
							scope={host.scope}
							mediaBase={host.mediaBase}
							{nav}
							reasons={entityChanged(host, entity.id)}
						/>
					{/if}
					{#if entity.category !== 'components'}
						<EntityAudio {evidence} scope={host.scope} mediaBase={host.mediaBase} />
					{/if}
				{/snippet}
			</EntitySections>
		{/snippet}
	</EntityFrame>
</hx-div>

<style>
	.ex-screen {
		display: contents;
	}
</style>
