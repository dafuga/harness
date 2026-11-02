<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_edp7feddfk -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		as = 'p',
		className = 'ex-empty',
		role = undefined,
		id,
		label,
		component,
		children
	}: {
		/** Semantic paragraph or block container; defaults to p. */
		as?: 'p' | 'div';
		/** Existing owner treatment; defaults to ex-empty. */
		className?: string;
		/** Optional semantic role. Defaults to JavaScript undefined, omitting role.
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
	.ex-empty :global(a) {
		display: inline-block;
		margin-inline-start: var(--hx-space-8);
	}
</style>
