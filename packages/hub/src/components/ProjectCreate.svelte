<script lang="ts">
	import CategoryImplementation from './projects-sessions/ProjectCreate.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
