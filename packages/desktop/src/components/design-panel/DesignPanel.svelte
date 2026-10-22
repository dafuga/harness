<script lang="ts">
	import CategoryImplementation from '../planning-collaboration/design-panel/DesignPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let {
		version = $bindable(''),
		option = $bindable(''),
		...props
	}: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:version bind:option />
