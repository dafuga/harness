<script lang="ts">
	import type { UnitDocumentation } from '../../../../../src/utils/unit-documentation/unitDocumentation';
	import UsageExamples from '../shared-primitives/usage-examples/UsageExamples.svelte';
	let {
		documentation,
		setupTitle
	}: {
		documentation?: UnitDocumentation;
		/** Names a setup shown once before the calls, such as how a service is created. */
		setupTitle?: string;
	} = $props();
	let examples = $derived(documentation?.examples ?? []);
</script>

{#if examples.length}
	{#if setupTitle && !documentation?.setup}
		<p class="ex-gap">How to create it is not documented at this commit.</p>
	{/if}
	<UsageExamples {examples} setup={documentation?.setup} {setupTitle} />
{:else}
	<p class="ex-gap">No usage examples are documented at this commit.</p>
	{#if documentation?.gap}<p class="ex-gap">{documentation.gap}</p>{/if}
{/if}

<style>
	.ex-gap {
		margin: 0;
		font-size: var(--hx-type-size-sm);
		color: var(--hx-color-text-supporting);
	}
</style>
