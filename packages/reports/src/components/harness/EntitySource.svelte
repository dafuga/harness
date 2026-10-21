<script lang="ts">
	import CategoryImplementation from '../explorer-ui/harness/EntitySource.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
<script lang="ts" module>
	export { archivedSource } from '../explorer-ui/harness/EntitySource.svelte';
</script>
