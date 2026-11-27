<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_3u5oqikjhu -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { forgetHubPush } from '../../lib/networking-security/hubPush';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { projectId }: { projectId?: string } = $props();
	const { api, session } = browserContext();

	function signOut() {
		// Notifications never hold up signing out.
		void forgetHubPush(api)
			.catch(() => {})
			.then(() => session.signOut());
	}
</script>

<!-- Leaving the workspace is a document navigation: its history entries are its own. -->
{#if session.actor}<hx-span class="account-name" title={session.actor.email}
		>{session.actor.name}</hx-span
	><hx-a href={resolve('/projects')} data-sveltekit-reload>Projects</hx-a>
	<hx-a href={resolve('/devices')}>Devices</hx-a>
	<hx-a href={resolve('/about') + '#download'}>Download</hx-a>{#if projectId}<hx-a
			href={resolve('/projects/[projectId]/members', { projectId })}
			data-sveltekit-reload>Members</hx-a
		><hx-a
			href={resolve('/projects/[projectId]/designs/[[canvas]]', { projectId })}
			data-sveltekit-reload>Designs</hx-a
		>{/if}<hx-button type="button" disabled={session.busy} onclick={signOut}>Sign out</hx-button
	>{/if}
