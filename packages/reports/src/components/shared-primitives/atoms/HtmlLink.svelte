<!-- @harness-tier atom -->
<!-- @harness-element link -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'link'} {...attributes}>

</svelte:element>
