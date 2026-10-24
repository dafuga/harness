<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './planning-collaboration/FloatingChat.svelte';
	import type { ComponentProps } from 'svelte';
	let { open = $bindable(false), ...props }: ComponentProps<typeof CategoryImplementation> =
		$props();
</script>

<CategoryImplementation {...props} bind:open />
