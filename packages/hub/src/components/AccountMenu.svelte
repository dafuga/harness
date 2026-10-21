<script lang="ts">
	import CategoryImplementation from './accounts-access/AccountMenu.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
