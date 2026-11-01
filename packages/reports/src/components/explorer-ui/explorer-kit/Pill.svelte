<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		as = 'span',
		variant = 'explorer',
		tone = '',
		state,
		role,
		label,
		title,
		children
	}: {
		/** Semantic inline or list-item container; defaults to span. */
		as?: 'span' | 'li';
		/** Existing visual treatment; defaults to explorer, with compact pill and Desktop chip alternatives. */
		variant?: 'explorer' | 'compact' | 'chip';
		/** Additional owner classes; defaults to an empty string. */
		tone?: string;
		/** Optional styling state. Defaults to JavaScript undefined, omitting data-state. */
		state?: string;
		/** Optional semantic role. Defaults to JavaScript undefined. */
		role?: 'img' | 'status';
		/** Optional accessible label. Defaults to JavaScript undefined. */
		label?: string;
		/** Optional native tooltip. Defaults to JavaScript undefined. */
		title?: string;
		/** Required caller-owned content; snippet errors propagate. */
		children: Snippet;
	} = $props();
	const classes = $derived(
		[variant === 'explorer' ? 'ex-pill' : variant === 'compact' ? 'pill' : 'chip', tone]
			.filter(Boolean)
			.join(' ')
	);
</script>

<hx-element this={as} class={classes} data-state={state} {role} aria-label={label} {title}
	>{@render children()}</hx-element
>
