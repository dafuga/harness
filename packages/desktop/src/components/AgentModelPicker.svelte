<script lang="ts">
	import CategoryImplementation from './agents-providers/AgentModelPicker.svelte';
	import type { ComponentProps } from 'svelte';
	let {
		provider = $bindable(),
		model = $bindable(),
		...props
	}: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:provider bind:model />
