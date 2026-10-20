<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { projectList } from '../utils/projectList';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
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
		font-size: 14px;
	}
	/* In its dialog the switcher is a field of the dialog's width, drawn as a field. */
	.picker-field {
		display: grid;
		gap: 6px;
		font-size: 12px;
	}
	.picker-field :global(.report-select) {
		display: block;
	}
	.picker-field :global(select) {
		max-width: none;
		border-color: var(--line);
		background: #062031;
	}
</style>
