<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	let { children }: { children: Snippet } = $props();
</script>

<hx-div class="workspace hub-page">
	<hx-header class="topbar">
		<hx-a class="brand" href={resolve('/')} data-sveltekit-reload
			><hx-span class="brand-mark"><BrandMark /></hx-span> Harness</hx-a
		><hx-span class="hub-title">Shared projects</hx-span>
		<hx-div class="account"><AccountMenu /></hx-div>
	</hx-header>
	<hx-main class="hub-main">{@render children()}</hx-main>
</hx-div>
