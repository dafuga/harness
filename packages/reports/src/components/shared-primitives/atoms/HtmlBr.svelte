<!-- @harness-tier atom -->
<!-- @harness-element br -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'br'} {...attributes}>

</svelte:element>
