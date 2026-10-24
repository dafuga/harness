<!-- @harness-tier atom -->
<!-- @harness-element menu -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'menu'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
