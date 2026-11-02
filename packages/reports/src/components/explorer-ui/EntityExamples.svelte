<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_qmlfwe5rfm -->
<script lang="ts">
	import Notice from './explorer-kit/Notice.svelte';
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
		<Notice as="p" className={'ex-gap entity-examples-ex-gap'}
			>How to create it is not documented at this commit.</Notice
		>
	{/if}
	<UsageExamples {examples} setup={documentation?.setup} {setupTitle} />
{:else}
	<Notice as="p" className={'ex-gap entity-examples-ex-gap'}
		>No usage examples are documented at this commit.</Notice
	>
	{#if documentation?.gap}<Notice as="p" className={'ex-gap entity-examples-ex-gap'}
			>{documentation.gap}</Notice
		>{/if}
{/if}

<style>
	:global(.entity-examples-ex-gap) {
		margin: 0;
		font-size: var(--hx-type-size-sm);
		color: var(--hx-color-text-supporting);
	}
</style>
