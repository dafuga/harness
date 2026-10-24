<!-- @harness-tier atom -->
<!-- @harness-element select -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'select'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
