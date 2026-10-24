<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import HostedWorkspace from '../../../../../components/projects-sessions/HostedWorkspace.svelte';
	import HubFrame from '../../../../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import { browserContext } from '../../../../../utils/development-tooling/browserContext';
	const { session } = browserContext();
</script>

<!-- Nothing of a project is read before the server has said who is signed in. -->
{#if session.actor}<HostedWorkspace />{:else}<HubFrame
		><hx-h1>Shared project</hx-h1>
		<LoginPanel reason="Sign in to open this project." /></HubFrame
	>{/if}
