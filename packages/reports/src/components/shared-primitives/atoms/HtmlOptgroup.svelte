<!-- @harness-tier atom -->
<!-- @harness-element optgroup -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'optgroup'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
