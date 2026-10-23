<script lang="ts">
	import { resolve } from '$app/paths';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { projectId }: { projectId?: string } = $props();
	const { session } = browserContext();
</script>

<!-- Leaving the workspace is a document navigation: its history entries are its own. -->
{#if session.actor}<span class="account-name" title={session.actor.email}>{session.actor.name}</span
	><a href={resolve('/', {})} data-sveltekit-reload>Projects</a>{#if projectId}<a
			href={resolve('/projects/[projectId]/members', { projectId })}
			data-sveltekit-reload>Members</a
		>{/if}<button type="button" disabled={session.busy} onclick={() => void session.signOut()}
		>Sign out</button
	>{/if}
