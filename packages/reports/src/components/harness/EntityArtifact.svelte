<script lang="ts">
	import CategoryImplementation from '../explorer-ui/harness/EntityArtifact.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
