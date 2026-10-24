<!-- @harness-tier atom -->
<!-- @harness-element img -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'img'} {...attributes}>

</svelte:element>
