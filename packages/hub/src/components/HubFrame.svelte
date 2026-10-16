<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import AccountMenu from './AccountMenu.svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="workspace hub-page">
	<header class="topbar">
		<a class="brand" href={resolve('/')} data-sveltekit-reload
			><span class="brand-mark"><BrandMark /></span> Harness</a
		><span class="hub-title">Shared projects</span>
		<div class="account"><AccountMenu /></div>
	</header>
	<main class="hub-main">{@render children()}</main>
</div>
