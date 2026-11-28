<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_iileqbawb5 -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import Modal from '$shared/Modal.svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { children, section = 'Shared projects' }: { children: Snippet; section?: string } = $props();
	const { session } = browserContext();
	let menuOpen = $state(false);
</script>

<hx-div class="workspace hub-page">
	<hx-header class="topbar">
		<hx-a class="brand" href={resolve('/')} aria-label="Harness" data-sveltekit-reload
			><hx-span class="brand-mark"><BrandMark /></hx-span></hx-a
		><hx-span class="hub-title">{section}</hx-span>
		<hx-div class="account account-inline"><AccountMenu /></hx-div>
		{#if session.actor}
			<hx-button
				class="account-menu-button"
				type="button"
				aria-haspopup="dialog"
				onclick={() => (menuOpen = true)}>Menu</hx-button
			>
		{/if}
	</hx-header>
	<Modal open={menuOpen} title="Menu" variant="text" onClose={() => (menuOpen = false)}>
		<hx-div class="account account-rows"><AccountMenu /></hx-div>
	</Modal>
	<hx-main class="hub-main">{@render children()}</hx-main>
</hx-div>
