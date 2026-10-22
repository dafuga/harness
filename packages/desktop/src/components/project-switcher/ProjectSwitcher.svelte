<script lang="ts">
	import CategoryImplementation from '../projects-sessions/project-switcher/ProjectSwitcher.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
