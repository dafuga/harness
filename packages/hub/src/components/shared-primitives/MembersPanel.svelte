<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pmdjhvtebz -->
<!-- @harness-view overview -->
<script lang="ts">
	import Modal from '$shared/Modal.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { Member, ProjectSummary } from 'collaboration';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import InvitationForm from '../projects-sessions/invitation-form/InvitationForm.svelte';
	let { projectId }: { projectId: string } = $props();
	const { projects } = browserContext();
	let project = $state<ProjectSummary | null>(null);
	let members = $state<Member[]>([]);
	let error = $state('');
	/** The invitation form opens in a dialog over the member list. */
	let inviting = $state(false);
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
{#if project}{#if project.role === 'owner'}<hx-div class="hub-actions">
			<hx-button
				type="button"
				class="primary"
				aria-haspopup="dialog"
				onclick={() => (inviting = true)}>Invite someone</hx-button
			>
		</hx-div>{/if}
	<hx-section class="hub-list" aria-labelledby="hub-members-title">
		<hx-div class="hub-list-head">
			<hx-h2 id="hub-members-title">People</hx-h2>
			<hx-a href={resolve('/projects')} data-sveltekit-reload>All projects</hx-a>
		</hx-div>
		{#if members.length}<hx-ul>
				{#each members as item (item.actorId)}<hx-li class="hub-list-row">
						<hx-span class="hub-list-name"
							><hx-strong>{item.name}</hx-strong><hx-small>{item.email}</hx-small></hx-span
						><hx-span class="hub-list-meta member-role">{item.role}</hx-span>
					</hx-li>{/each}
			</hx-ul>{:else}<hx-p class="hub-list-empty">No members are listed.</hx-p>{/if}
	</hx-section>
	{#if project.role !== 'owner'}<hx-p class="muted"
			>Only an owner of this project invites people.</hx-p
		>{/if}
	<Modal open={inviting} title="Invite someone" variant="text" onClose={() => (inviting = false)}
		><InvitationForm {projectId} /></Modal
	>{/if}

<style>
	.member-role {
		text-transform: capitalize;
	}
</style>
