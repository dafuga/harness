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
		gap: 24px;
	}
	article {
		min-width: 0;
	}
	h3 {
		margin: 0 0 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: #edf4fa;
	}
	pre {
		margin: 0;
		padding: 14px 16px;
		border: 1px solid #263d4d;
		border-radius: 8px;
		background: #0b1821;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: #d5e4ef;
	}
	code {
		font:
			0.82rem/1.6 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}
</style>
