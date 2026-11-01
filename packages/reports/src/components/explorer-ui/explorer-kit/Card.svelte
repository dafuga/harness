<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/** Shared card structure with the owner's accessible name, attribution and visual variant. */
	let {
		as = 'article',
		variant = 'card',
		tone = '',
		id,
		label,
		labelledby,
		component,
		children
	}: {
		/** Semantic container; defaults to article, with section and list-item support. */
		as?: 'article' | 'section' | 'li';
		/** Standard card treatment, or a module's existing specialized styling; defaults to card. */
		variant?: 'card' | 'module';
		/** Additional owner classes; defaults to an empty string. */
		tone?: string;
		/** Optional native id, omitted by default. */
		id?: string;
		/** Optional accessible name, omitted by default. */
		label?: string;
		/** Optional heading id naming the region, omitted by default. */
		labelledby?: string;
		/** Optional owning component attribution, omitted by default. */
		component?: string;
		/** Required card content; rendering errors propagate. */
		children: Snippet;
	} = $props();
	let classes = $derived([variant === 'card' ? 'ex-card' : '', tone].filter(Boolean).join(' '));
	let attributes = $derived({
		id,
		'aria-label': label,
		'aria-labelledby': labelledby,
		'data-harness-component': component
	});
</script>

{#if as === 'li'}
	<hx-li class={classes} {...attributes}>{@render children()}</hx-li>
{:else if as === 'section'}
	<hx-section class={classes} {...attributes}>{@render children()}</hx-section>
{:else}
	<hx-article class={classes} {...attributes}>{@render children()}</hx-article>
{/if}
