<!-- @harness-tier atom -->
<!-- @harness-element area -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'area'} {...attributes}>

</svelte:element>
