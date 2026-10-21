<script lang="ts">
	import type { UnitDocumentation } from '../../../../../src/utils/unit-documentation/unitDocumentation';
	import UsageExamples from '../shared-primitives/usage-examples/UsageExamples.svelte';
	let { documentation }: { documentation?: UnitDocumentation } = $props();
	let examples = $derived(documentation?.examples ?? []);
</script>

{#if examples.length}
	<UsageExamples {examples} setup={documentation?.setup} />
{:else}
	<p class="ex-gap">No usage examples are documented at this commit.</p>
	{#if documentation?.gap}<p class="ex-gap">{documentation.gap}</p>{/if}
{/if}

<style>
	.ex-gap {
		margin: 0;
		font-size: 0.9rem;
		color: #b6cad9;
	}
</style>
