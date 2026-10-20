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

{#if projects.length}{#each groups as group (group.name)}<section
			class="project-list"
			aria-label={group.name}
		>
			<h2>{group.name}</h2>
			<ul class="project-list">
				{#each group.items as item (item.id)}<li class="hub-card">
						<div>
							<h3>{item.name}</h3>
							<p class="muted">
								{item.sourceRepository.owner}/{item.sourceRepository.name} · {item.role}
							</p>
						</div>
						{#if item.role === 'owner'}<a
								href={resolve('/projects/[projectId]/members', { projectId: item.id })}
								data-sveltekit-reload>Members</a
							>{/if}<a
							class="outline gold"
							aria-label={`Open ${item.name}`}
							href={resolve('/projects/[projectId]/harness/[...path]', {
								projectId: item.id,
								path: 'pages'
							})}
							data-sveltekit-reload>Open <span>→</span></a
						>
					</li>{/each}
			</ul>
		</section>{/each}{:else}<section class="hub-card">
		<h2>No shared projects yet</h2>
		<p>
			An owner connects a GitHub repository and creates a project, or sends you an invitation link
			and its code.
		</p>
		<p class="muted">
			Projects you own or join appear here and on every device signed in with this Google account.
		</p>
	</section>{/if}
