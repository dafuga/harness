<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_phov5plaq2 -->
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
	<hx-div class="gate">
		<hx-h1>Join a shared project</hx-h1>
		{#if session.actor}<InviteAccept
				projectId={page.params.projectId ?? ''}
				invitationId={page.params.invitationId ?? ''}
			/>{:else}<LoginPanel
				reason="Sign in with the Google account the invitation was made for. You then enter its code."
			/>{/if}
	</hx-div>
</HubFrame>

<style>
	.gate {
		display: grid;
		gap: var(--hx-space-18);
		text-align: center;
	}
	.gate :global(.gate-card) {
		justify-self: center;
		width: min(100%, 480px);
		text-align: left;
	}
	.gate :global(.gate-card > :first-child) {
		margin-top: 0;
	}
	.gate :global(.code-field),
	.gate :global(.code-field input) {
		min-height: 44px;
		font-family: var(--hx-font-family-code);
	}
	.gate :global(.gate-card button) {
		min-height: 44px;
	}
</style>
