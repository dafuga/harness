<script lang="ts">
	import { onMount } from 'svelte';
	import WorkspaceShell from '$desktop/components/WorkspaceShell.svelte';
	import { createWorkspaceStore } from '$desktop/lib/stores/workspace.svelte';
	import { isWorkspacePath } from '$desktop/utils/workspaceRoute';
	import { browserBridge } from '../utils/browserBridge';
	import { browserContext } from '../utils/browserContext';
	import AccountMenu from './AccountMenu.svelte';
	import HubFrame from './HubFrame.svelte';
	const { api } = browserContext();
	const workspace = createWorkspaceStore();
	/** The desktop workspace over the browser bridge: shared projects only, and no local folder. */
	onMount(() => {
		workspace.connect(browserBridge(api), { local: false });
		const show = () => {
			if (isWorkspacePath(location.pathname)) void workspace.navigate(location.pathname, false);
		};
		void workspace.loadProjects();
		show();
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
{#if workspace.snapshot}<WorkspaceShell {workspace}
		>{#snippet account()}<AccountMenu
				projectId={workspace.projectId ?? undefined}
			/>{/snippet}</WorkspaceShell
	>{:else}<HubFrame
		><section class="hub-card">
			{#if workspace.error}<h1>This project could not be opened</h1>
				<p class="error" role="alert">{workspace.error}</p>{:else}<p class="muted">
					Loading project…
				</p>{/if}
		</section></HubFrame
	>{/if}
