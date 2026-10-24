<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { behaviorDuration } from '../../utils/explorer-ui/entityBehavior';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { entityChanged } from '../../utils/explorer-ui/entityShown';
	import EntityAudio from './EntityAudio.svelte';
	import EntityBehavior from './EntityBehavior.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntitySections from './entity-sections/EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- What is run: a function or a service opens on what its end-to-end checks recorded. The
	marker of the screen draws no box. -->
<hx-div class="ex-screen" data-harness-component="harness-entity-behavior-screen">
	<EntityFrame {host}>
		{#snippet children(entity, nav)}
			<EntitySections {host} {entity} {nav}>
				{#snippet pane()}
					{@const evidence = host.lens.evidence(entity.unit)}
					{@const behavior = host.lens.behavior(entity.unit)}
					{@const ran = behavior.scenarios.map((scenario) => scenario.id)}
					<!-- Another entity or commit starts from results that were not read yet. -->
					{#key entity.id + host.scope.commit}
						<EntityBehavior
							{behavior}
							scope={host.scope}
							mediaBase={host.mediaBase}
							{nav}
							reasons={entityChanged(host, entity.id)}
							duration={behaviorDuration(evidence.after.record, ran) ?? undefined}
							unit={entity.category === 'functions' ? entity.id : undefined}
						/>
					{/key}
					<EntityAudio {evidence} scope={host.scope} mediaBase={host.mediaBase} />
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
