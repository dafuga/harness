<script lang="ts">
	import CategoryImplementation from './development-tooling/DeploymentRoute.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
