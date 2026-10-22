<script lang="ts">
	import CategoryImplementation from '../accounts-access/login-panel/LoginPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
