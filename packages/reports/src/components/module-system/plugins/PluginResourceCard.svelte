<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ptpw6waing -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		ModuleEntry,
		ModuleResource
	} from '../../../../../../src/services/module-system/moduleDefinition.types';
	import Card from '../../explorer-ui/explorer-kit/Card.svelte';
	import CommandBlock from '../../explorer-ui/explorer-kit/CommandBlock.svelte';
	import PluginSteps from './PluginSteps.svelte';
	/** One resource type of a plugin: its title, how to make one, and the generate command. */
	let { entry, resource, title }: { entry: ModuleEntry; resource: ModuleResource; title: Snippet } =
		$props();
</script>

<Card tone="mod-card">
	<hx-h3 class="mod-title">{@render title()}</hx-h3>
	<PluginSteps lines={resource.instructions} />
	<CommandBlock
		label={entry.installed ? 'Generate' : 'Generate, once installed'}
		command={`harness plugin generate ${entry.definition.id} ${resource.id} Example`}
	/>
</Card>

<style>
	.mod-title {
		color: var(--ex-text);
		font-size: var(--hx-type-size-lg);
		overflow-wrap: anywhere;
	}
</style>
