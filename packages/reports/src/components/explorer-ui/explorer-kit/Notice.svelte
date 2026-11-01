<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		as = 'p',
		className = 'ex-notice',
		role = 'note',
		id,
		label,
		component,
		children
	}: {
		/** Semantic paragraph or block container; defaults to p. */
		as?: 'p' | 'div';
		/** Existing owner treatment; defaults to ex-notice. */
		className?: string;
		/** Optional semantic role. Defaults to note.
		 */
		role?: 'note' | 'status' | 'alert';
		/** Optional native id. Defaults to JavaScript undefined. */
		id?: string;
		/** Optional accessible name. Defaults to JavaScript undefined. */
		label?: string;
		/** Optional owner attribution. Defaults to JavaScript undefined. */
		component?: string;
		/** Required explanation or empty-state content; snippet errors propagate. */
		children: Snippet;
	} = $props();
</script>

<hx-element
	this={as}
	class={className}
	{role}
	{id}
	aria-label={label}
	data-harness-component={component}>{@render children()}</hx-element
>

<style>
	.ex-notice {
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
</style>
