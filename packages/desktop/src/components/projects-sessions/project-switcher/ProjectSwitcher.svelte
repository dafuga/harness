<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hdzxlphy4k -->
<script lang="ts">
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import { projectList } from './projectList';
	import ChoiceDialog from '../../shared-primitives/ChoiceDialog.svelte';
	import ChoiceRow from '../../shared-primitives/ChoiceRow.svelte';
	import ChoiceRows from '../../shared-primitives/ChoiceRows.svelte';
	import Icon from '../../shared-primitives/Icon.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	/** Follows the shown project; a choice is held only until the switch has ended. */
	let value = $derived(workspace.projectId ?? '');
	const projects = $derived(projectList(workspace.projects, workspace.snapshot));
	const local = $derived(projects.filter((item) => item.kind === 'local'));
	const shared = $derived(projects.filter((item) => item.kind === 'shared'));
	/** The shown workbench stays named in the bar; the list of the others waits behind its icon. */
	const name = $derived(workspace.snapshot?.project.name ?? '');
	/** A switch that fails leaves the shown project selected. */
	async function choose(close: () => void, id: string) {
		close();
		value = id;
		await workspace.switchProject(id);
		value = workspace.projectId ?? '';
	}
</script>

<hx-div class="project-switcher">
	<ChoiceDialog
		label="Choose workbench"
		title="Choose workbench"
		width={480}
		maxHeight={320}
		disabled={workspace.busy}
	>
		{#snippet icon()}<Icon name="workbench" size={18} />{/snippet}
		{#snippet children(close: () => void)}{#if projects.length === 0}<hx-span
					>No projects yet</hx-span
				>{:else}{#if local.length}<ChoiceRows
						title={workspace.local ? 'On this device' : 'On your computer'}
						label={workspace.local ? 'On this device' : 'On your computer'}
					>
						{#each local as item (item.id)}<ChoiceRow
								name={item.name}
								current={item.id === value}
								onchoose={() => void choose(close, item.id)}
							/>{/each}
					</ChoiceRows>{/if}{#if shared.length}<ChoiceRows title="Shared" label="Shared">
						{#each shared as item (item.id)}<ChoiceRow
								name={item.name}
								current={item.id === value}
								onchoose={() => void choose(close, item.id)}
							/>{/each}
					</ChoiceRows>{/if}{/if}{/snippet}
	</ChoiceDialog>{#if name}<hx-span class="project-name" title={name}>{name}</hx-span
		>{/if}{#if workspace.bridge && workspace.local}<hx-button
			type="button"
			class="add-project"
			aria-label="Add local project"
			title="Add local project"
			disabled={workspace.busy}
			onclick={() => void workspace.openProject()}>+</hx-button
		>{/if}
	{#if workspace.busy}<hx-span class="muted" role="status">Loading project…</hx-span>{/if}
</hx-div>

<style>
	.project-name {
		min-width: 0;
		max-width: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--hx-type-size-sm);
	}
	/* Narrower than a desktop the switcher is no bordered column of the bar. */
	@media (max-width: 1250px) {
		.project-switcher {
			border-inline: 0;
			padding: 0;
		}
	}
	/* On a phone the name is the row's title, cut short only where the row ends, and the choice and
	   Add are quiet icons beside it. */
	@media (max-width: 560px) {
		.project-switcher {
			gap: var(--hx-space-2);
			margin-inline: var(--hx-space-6);
		}
		.project-name {
			max-width: none;
			padding-inline: var(--hx-space-2);
			font-size: var(--hx-type-size-base);
			font-weight: var(--hx-style-weight-semibold);
		}
		.add-project {
			border-color: transparent;
			background: none;
			font-size: var(--hx-type-size-xl);
		}
		.add-project:focus-visible {
			outline-offset: calc(-1 * var(--hx-space-2));
		}
	}
</style>
