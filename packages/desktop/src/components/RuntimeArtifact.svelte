<script lang="ts">
	import CategoryImplementation from './execution-runtimes/RuntimeArtifact.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
