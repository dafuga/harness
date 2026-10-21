<script lang="ts">
	import HostedWorkspace from '../../../../../components/HostedWorkspace.svelte';
	import HubFrame from '../../../../../components/HubFrame.svelte';
	import LoginPanel from '../../../../../components/login-panel/LoginPanel.svelte';
	import { browserContext } from '../../../../../utils/browserContext';
	const { session } = browserContext();
</script>

<!-- Nothing of a project is read before the server has said who is signed in. -->
{#if session.actor}<HostedWorkspace />{:else}<HubFrame
		><h1>Shared project</h1>
		<LoginPanel reason="Sign in to open this project." /></HubFrame
	>{/if}
