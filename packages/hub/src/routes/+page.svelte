<!-- @harness-tier page -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5k4pvex6a2 -->
<script lang="ts">
	import HubHome from '../components/projects-sessions/HubHome.svelte';
	import { browserContext } from '../utils/development-tooling/browserContext';
	import BrandMark from '$shared/BrandMark.svelte';
	import LoginPanel from '../components/accounts-access/login-panel/LoginPanel.svelte';
	const { session } = browserContext();
</script>

<svelte:head><title>{session.actor ? 'Harness · Home' : 'Harness · Sign in'}</title></svelte:head>
{#if session.actor}
	{#key session.actor.id}<HubHome />{/key}
{:else if session.status || session.error}
	<hx-main class="sign-in">
		<hx-div class="sign-in-inner">
			<BrandMark size={40} />
			<hx-h1>Harness</hx-h1>
			<hx-p class="muted">Understand your project. Design what comes next.</hx-p>
			<LoginPanel compact />
			<hx-p class="note">Use the same Google account on your phone and computer.</hx-p>
		</hx-div>
	</hx-main>
{:else}
	<hx-main aria-busy="true" aria-label="Loading Harness"></hx-main>
{/if}

<style>
	.sign-in {
		min-height: 100dvh;
	}
	.sign-in-inner {
		display: grid;
		justify-items: center;
		gap: var(--hx-space-12);
		width: min(100%, 420px);
		margin: 0 auto;
		padding: 22vh var(--hx-space-24) var(--hx-space-40);
		text-align: center;
	}
	.sign-in-inner h1,
	.note {
		margin: 0;
	}
	.note {
		font-size: var(--hx-type-size-xs);
		color: var(--hx-color-text-muted);
	}
</style>
