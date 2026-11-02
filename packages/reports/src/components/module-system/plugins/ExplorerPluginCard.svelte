<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_cl5o34voyf -->
<script lang="ts">
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	import type { Snippet } from 'svelte';
	import type { ModuleEntry } from '../../../../../../src/services/module-system/moduleDefinition.types';
	import Card from '../../explorer-ui/explorer-kit/Card.svelte';
	import CommandBlock from '../../explorer-ui/explorer-kit/CommandBlock.svelte';
	import PluginStatePills from './PluginStatePills.svelte';
	/** One plugin in the library: its linked title, state, description, resource types and install command. */
	let { entry, title }: { entry: ModuleEntry; title: Snippet } = $props();
	let module = $derived(entry.definition);
</script>

<Card tone="mod-card">
	<hx-header class="mod-head">
		<hx-h2 class="mod-title">{@render title()}</hx-h2>
		<PluginStatePills {entry} />
	</hx-header>
	<hx-p class="mod-text">{module.description}</hx-p>
	<hx-ul class="mod-kinds" aria-label={`${module.title} resource types`}>
		{#each module.resources as resource (resource.id)}
			<Pill as="li" variant="explorer" tone="explorer-plugin-card-ex-pill">{resource.title}</Pill>
		{/each}
	</hx-ul>
	{#if !entry.installed}<CommandBlock
			label="Install"
			command={`harness plugin add ${module.id}`}
		/>{/if}
</Card>

<style>
	.mod-title {
		color: var(--ex-text);
		font-size: var(--hx-type-size-lg);
		overflow-wrap: anywhere;
	}
	.mod-head,
	.mod-kinds {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-6) var(--hx-space-10);
	}
	.mod-head {
		justify-content: space-between;
	}
	.mod-text {
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
</style>
