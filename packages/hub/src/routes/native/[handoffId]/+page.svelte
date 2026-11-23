<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_ubktxpp6mt -->
<script lang="ts">
	import { page } from '$app/state';
	import HubFrame from '../../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import NativeApproval from '../../../components/shared-primitives/native-approval/NativeApproval.svelte';
	import { browserContext } from '../../../utils/development-tooling/browserContext';
	const { session, api } = browserContext();
	const handoffId = $derived(page.params.handoffId ?? '');
	const browserReturn = $derived(page.url.searchParams.get('return') === '1');
	let submitting = $state(false);
	let error = $state('');

	async function returnToApp() {
		if (submitting) return;
		submitting = true;
		error = '';
		try {
			const { callbackUrl } = await api.send<{ callbackUrl: string }>(
				'POST',
				'/api/auth/native/return',
				{ handoffId }
			);
			location.replace(callbackUrl);
		} catch {
			error = 'This sign-in could not finish. Start again in Harness.';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Harness · Connect a Harness device</title>
</svelte:head>
<HubFrame>
	<hx-h1>Connect a Harness device</hx-h1>
	{#if session.actor && browserReturn}
		<hx-section class="hub-card">
			<hx-p>Sign in to the Harness app as {session.actor.email}.</hx-p>
			<hx-button type="button" disabled={submitting} onclick={() => void returnToApp()}>
				Continue to Harness
			</hx-button>
			<hx-button type="button" disabled={submitting} onclick={() => void session.signOut()}>
				Use another Google account
			</hx-button>
			{#if error}<hx-p role="alert">{error}</hx-p>{/if}
		</hx-section>
	{:else if session.actor}
		{#key handoffId}<NativeApproval {handoffId} />{/key}
	{:else}
		<LoginPanel
			reason={browserReturn
				? 'Sign in with Google to return to the Harness app.'
				: 'Sign in with Google to approve your Harness device. You then type the code it shows.'}
		/>
	{/if}
</HubFrame>
