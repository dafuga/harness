<script lang="ts">
	import { onMount } from 'svelte';
	import type { Member, ProjectSummary } from 'collaboration';
	import { browserContext } from '../utils/browserContext';
	import InvitationForm from './InvitationForm.svelte';
	let { projectId }: { projectId: string } = $props();
	const { projects } = browserContext();
	let project = $state<ProjectSummary | null>(null);
	let members = $state<Member[]>([]);
	let error = $state('');
	onMount(async () => {
		try {
			project = await projects.get(projectId);
			members = await projects.members(projectId);
		} catch (cause) {
			error = String(cause);
		}
	});
</script>

<h1>{project ? `Members of ${project.name}` : 'Members'}</h1>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if project}<section class="hub-card">
		<table class="members">
			<thead
				><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th></tr
				></thead
			>
			<tbody>
				{#each members as item (item.actorId)}<tr
						><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td></tr
					>{:else}<tr><td colspan="3" class="muted">No members are listed.</td></tr>{/each}
			</tbody>
		</table>
	</section>
	{#if project.role === 'owner'}<InvitationForm {projectId} />{:else}<p class="muted">
			Only an owner of this project invites people.
		</p>{/if}{/if}
