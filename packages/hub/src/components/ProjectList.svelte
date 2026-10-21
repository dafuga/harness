<script lang="ts">
	import CategoryImplementation from './projects-sessions/ProjectList.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
