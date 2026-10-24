<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	let { projects }: { projects: ProjectSummary[] } = $props();
	/** The projects this account owns, then the ones it joined; a group without any is not shown. */
	const groups = $derived(
		[
			{ name: 'Owned by you', items: projects.filter((item) => item.role === 'owner') },
			{ name: 'Shared with you', items: projects.filter((item) => item.role !== 'owner') }
		].filter((group) => group.items.length)
	);
</script>

{#if projects.length}{#each groups as group (group.name)}<hx-section
			class="project-list"
			aria-label={group.name}
		>
			<hx-h2>{group.name}</hx-h2>
			<hx-ul class="project-list">
				{#each group.items as item (item.id)}<hx-li class="hub-card">
						<hx-div>
							<hx-h3>{item.name}</hx-h3>
							<hx-p class="muted">
								{item.sourceRepository.owner}/{item.sourceRepository.name} · {item.role}
							</hx-p>
						</hx-div>
						{#if item.role === 'owner'}<hx-a
								href={resolve('/projects/[projectId]/members', { projectId: item.id })}
								data-sveltekit-reload>Members</hx-a
							>{/if}<hx-a
							class="outline gold"
							aria-label={`Open ${item.name}`}
							href={resolve('/projects/[projectId]/harness/[...path]', {
								projectId: item.id,
								path: 'pages'
							})}
							data-sveltekit-reload>Open <hx-span>→</hx-span></hx-a
						>
					</hx-li>{/each}
			</hx-ul>
		</hx-section>{/each}{:else}<hx-section class="hub-card">
		<hx-h2>No shared projects yet</hx-h2>
		<hx-p>
			An owner connects a GitHub repository and creates a project, or sends you an invitation link
			and its code.
		</hx-p>
		<hx-p class="muted">
			Projects you own or join appear here and on every device signed in with this Google account.
		</hx-p>
	</hx-section>{/if}
