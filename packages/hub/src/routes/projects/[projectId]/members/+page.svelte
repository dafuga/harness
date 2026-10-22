<script lang="ts">
	import { page } from '$app/state';
	import HubFrame from '../../../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import MembersPanel from '../../../../components/shared-primitives/MembersPanel.svelte';
	import { browserContext } from '../../../../utils/development-tooling/browserContext';
	const { session } = browserContext();
	const projectId = $derived(page.params.projectId ?? '');
</script>

<svelte:head><title>Harness · Members</title></svelte:head>
<HubFrame>
	{#if session.actor}{#key projectId}<MembersPanel {projectId} />{/key}{:else}<h1>Members</h1>
		<LoginPanel reason="Sign in to see who is in this project." />{/if}
</HubFrame>
