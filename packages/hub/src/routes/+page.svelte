<!-- @harness-tier page -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5k4pvex6a2 -->
<script lang="ts">
	import HubHome from '../components/projects-sessions/HubHome.svelte';
	import { browserContext } from '../utils/development-tooling/browserContext';
	import HomePage from '../components/public-site/HomePage.svelte';
	const { session } = browserContext();
</script>

<svelte:head
	><title>{session.actor ? 'Harness · Home' : 'Harness · Build with agents'}</title></svelte:head
>
{#if session.actor}
	{#key session.actor.id}<HubHome />{/key}
{:else if session.status || session.error}
	<HomePage />
{:else}
	<hx-main aria-busy="true" aria-label="Loading Harness"></hx-main>
{/if}
