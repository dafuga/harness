<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Member, ProjectSummary } from 'collaboration';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import InvitationForm from '../projects-sessions/invitation-form/InvitationForm.svelte';
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

<hx-h1>{project ? `Members of ${project.name}` : 'Members'}</hx-h1>
{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
{#if project}<hx-section class="hub-card">
		<hx-table class="members">
			<hx-thead
				><hx-tr
					><hx-th scope="col">Name</hx-th><hx-th scope="col">Email</hx-th><hx-th scope="col"
						>Role</hx-th
					></hx-tr
				></hx-thead
			>
			<hx-tbody>
				{#each members as item (item.actorId)}<hx-tr
						><hx-td>{item.name}</hx-td><hx-td>{item.email}</hx-td><hx-td>{item.role}</hx-td></hx-tr
					>{:else}<hx-tr><hx-td colspan="3" class="muted">No members are listed.</hx-td></hx-tr
					>{/each}
			</hx-tbody>
		</hx-table>
	</hx-section>
	{#if project.role === 'owner'}<InvitationForm {projectId} />{:else}<hx-p class="muted">
			Only an owner of this project invites people.
		</hx-p>{/if}{/if}
