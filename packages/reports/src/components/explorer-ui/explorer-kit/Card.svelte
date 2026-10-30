<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/** An explorer card: an article by default, or a section when it names a labelled region. */
	let {
		as = 'article',
		tone = '',
		labelledby,
		children
	}: {
		as?: 'article' | 'section';
		tone?: string;
		labelledby?: string;
		children: Snippet;
	} = $props();
	let classes = $derived(tone ? `ex-card ${tone}` : 'ex-card');
</script>

{#if as === 'section'}
	<hx-section class={classes} aria-labelledby={labelledby}>{@render children()}</hx-section>
{:else}
	<hx-article class={classes} aria-labelledby={labelledby}>{@render children()}</hx-article>
{/if}
