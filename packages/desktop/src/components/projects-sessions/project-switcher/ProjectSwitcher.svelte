<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import { projectList } from './projectList';
	let { workspace }: { workspace: Workspace } = $props();
	/** Follows the shown project; a choice is held only until the switch has ended. */
	let value = $derived(workspace.projectId ?? '');
	const projects = $derived(projectList(workspace.projects, workspace.snapshot));
	const local = $derived(projects.filter((item) => item.kind === 'local'));
	const shared = $derived(projects.filter((item) => item.kind === 'shared'));
	/** A switch that fails leaves the shown project selected. */
	async function choose() {
		await workspace.switchProject(value);
		value = workspace.projectId ?? '';
	}
</script>

<div class="project-switcher">
	<label onchange={() => void choose()}
		><Select label="Project" bind:value
			>{#if local.length}<optgroup label={workspace.local ? 'On this device' : 'On your computer'}
					>{#each local as item (item.id)}<option value={item.id}>{item.name}</option
						>{/each}</optgroup
				>{/if}{#if shared.length}<optgroup label="Shared"
					>{#each shared as item (item.id)}<option value={item.id}>{item.name}</option
						>{/each}</optgroup
				>{/if}</Select
		></label
	>{#if workspace.bridge && workspace.local}<button
			type="button"
			class="add-project"
			aria-label="Add local project"
			title="Add local project"
			disabled={workspace.busy}
			onclick={() => void workspace.openProject()}>+</button
		>{/if}
</div>
