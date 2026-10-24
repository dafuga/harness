<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { page } from '$app/state';
	import HubFrame from '../../../../components/shared-primitives/HubFrame.svelte';
	import InviteAccept from '../../../../components/shared-primitives/InviteAccept.svelte';
	import LoginPanel from '../../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import { browserContext } from '../../../../utils/development-tooling/browserContext';
	const { session } = browserContext();
</script>

<svelte:head><title>Harness · Invitation</title></svelte:head>
<HubFrame>
	<hx-h1>Join a shared project</hx-h1>
	{#if session.actor}<InviteAccept
			projectId={page.params.projectId ?? ''}
			invitationId={page.params.invitationId ?? ''}
		/>{:else}<LoginPanel
			reason="Sign in with the Google account the invitation was made for. You then enter its code."
		/>{/if}
</HubFrame>
