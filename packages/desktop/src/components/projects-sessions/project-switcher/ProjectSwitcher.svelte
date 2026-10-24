<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import { projectList } from './projectList';
	import ChoiceDialog from '../../shared-primitives/ChoiceDialog.svelte';
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
	async function choose(close: () => void) {
		close();
		await workspace.switchProject(value);
		value = workspace.projectId ?? '';
	}
</script>

<div class="project-switcher">
	<ChoiceDialog label="Choose workbench" title="Choose workbench" width={320} maxHeight={320}>
		{#snippet icon()}<Icon name="workbench" size={18} />{/snippet}
		{#snippet children(close: () => void)}<label
				class="picker-field"
				onchange={() => void choose(close)}
				>Project<Select label="Project" bind:value
					>{#if local.length}<optgroup
							label={workspace.local ? 'On this device' : 'On your computer'}
							>{#each local as item (item.id)}<option value={item.id}>{item.name}</option
								>{/each}</optgroup
						>{/if}{#if shared.length}<optgroup label="Shared"
							>{#each shared as item (item.id)}<option value={item.id}>{item.name}</option
								>{/each}</optgroup
						>{/if}</Select
				></label
			>{/snippet}
	</ChoiceDialog>{#if name}<span class="project-name" title={name}>{name}</span
		>{/if}{#if workspace.bridge && workspace.local}<button
			type="button"
			class="add-project"
			aria-label="Add local project"
			title="Add local project"
			disabled={workspace.busy}
			onclick={() => void workspace.openProject()}>+</button
		>{/if}
</div>

<style>
	.project-name {
		min-width: 0;
		max-width: 160px;
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
	/* In its dialog the switcher is a field of the dialog's width, drawn as a field. */
	.picker-field {
		display: grid;
		gap: var(--hx-space-6);
		font-size: var(--hx-type-size-xs);
	}
	.picker-field :global(.report-select) {
		display: block;
	}
	.picker-field :global(select) {
		max-width: none;
		border-color: var(--hx-color-border);
		background: var(--hx-color-surface-raised);
	}
</style>
