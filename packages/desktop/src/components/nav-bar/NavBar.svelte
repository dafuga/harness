<script lang="ts">
	import CategoryImplementation from '../projects-sessions/nav-bar/NavBar.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
