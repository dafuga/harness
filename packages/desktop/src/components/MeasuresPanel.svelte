<script lang="ts">
	import CategoryImplementation from './shared-primitives/MeasuresPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
