<script lang="ts">
	import { page } from '$app/state';
	import HubFrame from '../../../components/HubFrame.svelte';
	import LoginPanel from '../../../components/login-panel/LoginPanel.svelte';
	import NativeApproval from '../../../components/native-approval/NativeApproval.svelte';
	import { browserContext } from '../../../utils/browserContext';
	const { session } = browserContext();
	const handoffId = $derived(page.params.handoffId ?? '');
</script>

<!-- The address holds one identifier that is useless alone; the code is typed, never linked. -->
<svelte:head><title>Harness · Connect the desktop app</title></svelte:head>
<HubFrame>
	<h1>Connect the desktop app</h1>
	{#if session.actor}{#key handoffId}<NativeApproval {handoffId} />{/key}{:else}<LoginPanel
			reason="Sign in with Google to approve your desktop app. You then type the code it shows."
		/>{/if}
</HubFrame>
