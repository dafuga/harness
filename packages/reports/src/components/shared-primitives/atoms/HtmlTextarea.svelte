<!-- @harness-tier atom -->
<!-- @harness-element textarea -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'textarea'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
