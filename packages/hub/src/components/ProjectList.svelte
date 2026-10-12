<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	let { projects }: { projects: ProjectSummary[] } = $props();
</script>

{#if projects.length}<ul class="project-list">
		{#each projects as item (item.id)}<li class="hub-card">
				<div>
					<h2>{item.name}</h2>
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
	</ul>{:else}<section class="hub-card">
		<h2>No shared projects yet</h2>
		<p>
			An owner connects a GitHub repository and creates a project, or sends you an invitation link
			and its code.
		</p>
	</section>{/if}
