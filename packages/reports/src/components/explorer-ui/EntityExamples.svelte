<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { EntityExamplesProps } from './EntityExamples.types';
	import UsageExamples from '../shared-primitives/usage-examples/UsageExamples.svelte';
	import EntityAudio from './EntityAudio.svelte';
	let { documentation, setupTitle, recorded }: EntityExamplesProps = $props();
	let examples = $derived(documentation?.examples ?? []);
</script>

{#if examples.length}
	{#if setupTitle && !documentation?.setup}
		<hx-p class="ex-gap">How to create it is not documented at this commit.</hx-p>
	{/if}
	<UsageExamples {examples} setup={documentation?.setup} {setupTitle} />
{:else}
	<hx-p class="ex-gap">No usage examples are documented at this commit.</hx-p>
	{#if documentation?.gap}<hx-p class="ex-gap">{documentation.gap}</hx-p>{/if}
{/if}

{#if recorded}
	<hx-p class="ex-soft">These examples are authored documentation, not test results.</hx-p>
	<EntityAudio {...recorded} idPrefix="examples-" />
{/if}

<style>
	.ex-gap {
		margin: 0;
		font-size: var(--hx-type-size-sm);
		color: var(--hx-color-text-supporting);
	}
</style>
