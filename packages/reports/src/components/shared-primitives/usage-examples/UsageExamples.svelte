<script lang="ts">
	import type { UsageExample } from '../../../../../../src/utils/unit-documentation/unitDocumentation';
	import { usageExamples } from './usageExamples';
	let {
		examples,
		setup,
		setupTitle
	}: { examples: UsageExample[]; setup?: string; setupTitle?: string } = $props();
	// A titled setup leads once instead of preceding every call.
	let lead = $derived(setupTitle ? setup : undefined);
	let snippets = $derived(usageExamples(examples, lead ? undefined : setup));
</script>

<div class="examples">
	{#if lead}
		<article>
			<h3>{setupTitle}</h3>
			<pre><code>{lead}</code></pre>
		</article>
	{/if}
	{#each examples as example, position (position)}
		<article>
			<h3>{example.name}</h3>
			<pre><code>{snippets[position]}</code></pre>
		</article>
	{/each}
</div>

<style>
	.examples {
		display: grid;
		gap: var(--hx-space-24);
	}
	article {
		min-width: 0;
	}
	h3 {
		margin: 0 0 var(--hx-space-8);
		font-size: var(--hx-type-size-base);
		font-weight: var(--hx-style-weight-semibold);
		color: var(--hx-color-text);
	}
	pre {
		margin: 0;
		padding: var(--hx-space-14) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-background);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: var(--hx-color-text-supporting);
	}
	code {
		font: var(--hx-style-code-compact);
	}
</style>
