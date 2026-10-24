<!-- @harness-tier atom -->
<!-- @harness-element sub -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'sub'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
