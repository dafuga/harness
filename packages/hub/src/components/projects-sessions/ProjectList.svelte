<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_fuy5emshdu -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	let {
		projects,
		failure = null,
		overview = false
	}: {
		/** Null while the list is read. */
		projects: ProjectSummary[] | null;
		/** Why the list could not be read: not set up on this server, or a failed read. */
		failure?: 'setup' | 'read' | null;
		/** Offers the quiet Project overview link to the owner the server names. */
		overview?: boolean;
	} = $props();
	/** The projects this account owns come first, then the ones it joined. */
	const rows = $derived([
		...(projects ?? []).filter((item) => item.role === 'owner'),
		...(projects ?? []).filter((item) => item.role !== 'owner')
	]);
</script>

<hx-section class="hub-list" aria-labelledby="hub-projects-title">
	<hx-div class="hub-list-head">
		<hx-h2 id="hub-projects-title">Your projects</hx-h2>
		{#if overview}<hx-a href={resolve('/tracker-overview')}>Project overview</hx-a>{/if}
	</hx-div>
	{#if failure === 'setup'}<hx-p class="hub-list-empty" role="status"
			>Shared projects aren’t set up yet.</hx-p
		>{:else if failure === 'read'}<hx-p class="hub-list-empty" role="alert"
			>Shared projects couldn’t be loaded. Try again shortly.</hx-p
		>{:else if !projects}<hx-p class="hub-list-empty">Loading projects…</hx-p
		>{:else if rows.length}<hx-ul>
			{#each rows as item (item.id)}<hx-li class="hub-list-row">
					<hx-a
						class="hub-list-name"
						aria-label={`Open ${item.name}`}
						href={resolve('/projects/[projectId]/harness/[...path]', {
							projectId: item.id,
							path: 'pages'
						})}
						data-sveltekit-reload
						><hx-strong>{item.name}</hx-strong><hx-small
							>{item.sourceRepository.owner}/{item.sourceRepository.name}</hx-small
						></hx-a
					>
					<hx-span class="hub-list-meta"
						><hx-span class="project-role">{item.role}</hx-span>{#if item.role === 'owner'}<hx-a
								class="project-members"
								href={resolve('/projects/[projectId]/members', { projectId: item.id })}
								data-sveltekit-reload>Members</hx-a
							>{/if}</hx-span
					>
				</hx-li>{/each}
		</hx-ul>{:else}<hx-p class="hub-list-empty"
			>No shared projects yet. Create one from a GitHub repository, or join one with the invitation
			link and code its owner sends you.</hx-p
		>{/if}
</hx-section>

<style>
	.project-role {
		text-transform: capitalize;
	}
	.project-members {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--hx-color-primary);
	}
	.hub-list-name {
		flex: 1 1 12rem;
		min-height: 44px;
		align-content: center;
	}
</style>
