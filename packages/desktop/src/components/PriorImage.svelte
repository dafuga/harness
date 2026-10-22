<script lang="ts">
	import CategoryImplementation from './shared-primitives/PriorImage.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
