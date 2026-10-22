<script lang="ts">
	import CategoryImplementation from '../../explorer-ui/harness/entity-reasons/EntityReasons.svelte';
	import type { ComponentProps } from 'svelte';
	let { open = $bindable(false), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:open />
