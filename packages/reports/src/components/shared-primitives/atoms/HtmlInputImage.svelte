<!-- @harness-tier atom -->
<!-- @harness-element input image -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'input'} {...attributes} type="image">

</svelte:element>
