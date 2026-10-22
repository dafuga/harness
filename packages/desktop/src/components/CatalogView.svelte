<script lang="ts">
	import CategoryImplementation from './explorer-ui/CatalogView.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
