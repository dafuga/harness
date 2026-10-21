<script lang="ts">
	import CategoryImplementation from './agents-providers/AgentEffortPicker.svelte';
	import type { ComponentProps } from 'svelte';
	let { effort = $bindable(), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:effort />
