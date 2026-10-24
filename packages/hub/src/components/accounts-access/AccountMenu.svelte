<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { projectId }: { projectId?: string } = $props();
	const { session } = browserContext();
</script>

<!-- Leaving the workspace is a document navigation: its history entries are its own. -->
{#if session.actor}<hx-span class="account-name" title={session.actor.email}
		>{session.actor.name}</hx-span
	><hx-a href={resolve('/')} data-sveltekit-reload>Projects</hx-a>{#if projectId}<hx-a
			href={resolve('/projects/[projectId]/members', { projectId })}
			data-sveltekit-reload>Members</hx-a
		>{/if}<hx-button type="button" disabled={session.busy} onclick={() => void session.signOut()}
		>Sign out</hx-button
	>{/if}
