<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { ModuleEntry } from '../../../../../../src/services/module-system/moduleDefinition.types';
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	/** Whether a plugin is included, installed or available, and whether it is a testing tool. */
	let { entry }: { entry: ModuleEntry } = $props();
	let label = $derived(
		entry.definition.includedByDefault ? 'Included' : entry.installed ? 'Installed' : 'Available'
	);
</script>

<Pill tone="mod-state" state={label}>{label}</Pill>
{#if entry.definition.testing}<Pill>Testing</Pill>{/if}

<style>
	:global(.mod-state[data-state='Available']) {
		border-style: dashed;
		background: transparent;
		color: var(--ex-muted);
	}
</style>
