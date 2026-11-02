<!-- @harness-tier molecule -->
<!-- @harness-atoms ./atoms -->
<!-- @harness-uid u_tbet4rd6sx -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		text,
		mode = 'clip',
		action,
		className = ''
	}: {
		/** Complete source text, retained in the DOM and native hover text. */
		text: string;
		/** Clip to one line or preserve and wrap whitespace; defaults to clip. */
		mode?: 'clip' | 'wrap';
		/** Optional existing inspection control; the caller owns its behavior and focus return. */
		action?: Snippet;
		/** Optional feature-owned classes; defaults to an empty string. */
		className?: string;
	} = $props();
</script>

<hx-span class="code-line {className}" data-harness-component="shared-primitives-code-line">
	<hx-code class:wrap={mode === 'wrap'} title={text}>{text}</hx-code>
	{#if action}<hx-span class="action">{@render action()}</hx-span>{/if}
</hx-span>

<style>
	.code-line {
		display: inline-flex;
		align-items: baseline;
		gap: var(--hx-space-6);
		min-width: 0;
		max-width: 100%;
		vertical-align: bottom;
	}
	code {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	code.wrap {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.action {
		flex: 0 0 auto;
	}
</style>
