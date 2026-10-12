<script lang="ts">
	import { onMount } from 'svelte';
	import type { DesktopBridge } from '../models/DesktopBridge.types';
	import { createWorkspaceStore } from '../lib/stores/workspace.svelte';
	import { isWorkspacePath } from '../utils/workspaceRoute';
	import HostedConnection from '../components/HostedConnection.svelte';
	import ProjectGate from '../components/ProjectGate.svelte';
	import WorkspaceShell from '../components/WorkspaceShell.svelte';
	import '../lib/styles/workspace.css';
	import '../lib/styles/design.css';
	const workspace = createWorkspaceStore();
	let available = $state(false);
	onMount(() => {
		const bridge = (window as Window & { harness?: DesktopBridge }).harness;
		workspace.connect(bridge);
		available = Boolean(bridge);
		const show = () => {
			if (isWorkspacePath(location.pathname)) void workspace.navigate(location.pathname, false);
		};
		if (bridge) {
			void workspace.loadProjects();
			show();
		}
		window.addEventListener('popstate', show);
		return () => {
			window.removeEventListener('popstate', show);
			workspace.connect(undefined);
		};
	});
</script>

<svelte:head
	><title>Harness{workspace.snapshot ? ' · ' + workspace.snapshot.project.name : ''}</title
	></svelte:head
>
{#if workspace.snapshot}<WorkspaceShell {workspace} />{:else}<ProjectGate
		{available}
		busy={workspace.busy}
		open={() => void workspace.openProject()}
		projects={workspace.projects}
		choose={(projectId) => void workspace.switchProject(projectId)}
		>{#if available}<HostedConnection {workspace} />{/if}</ProjectGate
	>{#if workspace.error}<p class="error" role="alert">{workspace.error}</p>{/if}{/if}
