<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { page } from '$app/state';
	import HubFrame from '../../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import NativeApproval from '../../../components/shared-primitives/native-approval/NativeApproval.svelte';
	import { browserContext } from '../../../utils/development-tooling/browserContext';
	const { session } = browserContext();
	const handoffId = $derived(page.params.handoffId ?? '');
</script>

<!-- The address holds one identifier that is useless alone; the code is typed, never linked. -->
<svelte:head><title>Harness · Connect a Harness device</title></svelte:head>
<HubFrame>
	<hx-h1>Connect a Harness device</hx-h1>
	{#if session.actor}{#key handoffId}<NativeApproval {handoffId} />{/key}{:else}<LoginPanel
			reason="Sign in with Google to approve your Harness device. You then type the code it shows."
		/>{/if}
</HubFrame>
