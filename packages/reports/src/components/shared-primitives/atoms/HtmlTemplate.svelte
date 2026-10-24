<!-- @harness-tier atom -->
<!-- @harness-element template -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'template'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
