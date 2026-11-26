<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_4rzissm43d -->
<script lang="ts">
	import { page } from '$app/state';
	import HostedDesigns from '../../../../../components/planning-collaboration/HostedDesigns.svelte';
	import HubFrame from '../../../../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import { browserContext } from '../../../../../utils/development-tooling/browserContext';
	const { session } = browserContext();
</script>

<!-- Nothing of a project is read before the server has said who is signed in. -->
{#if session.actor}<HostedDesigns
		projectId={page.params.projectId ?? ''}
		canvas={page.params.canvas ?? null}
		branch={page.url.searchParams.get('branch')}
		commit={page.url.searchParams.get('commit')}
	/>{:else}<HubFrame section="Designs"
		><hx-h1>Shared project</hx-h1>
		<LoginPanel reason="Sign in to open this project." /></HubFrame
	>{/if}
