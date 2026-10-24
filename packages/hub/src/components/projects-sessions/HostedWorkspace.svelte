<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import WorkspaceShell from '$desktop/components/projects-sessions/WorkspaceShell.svelte';
	import { createWorkspaceStore } from '$desktop/lib/stores/projects-sessions/workspace.svelte';
	import { ProjectSyncService } from '$desktop/services/projects-sessions/ProjectSyncService';
	import { everyProject, forgetShared } from '$desktop/utils/cacheStatus';
	import { isWorkspacePath } from '$desktop/utils/projects-sessions/workspaceRoute';
	import { browserBridge } from '../../utils/browser-bridge/browserBridge';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	import HubFrame from '../shared-primitives/HubFrame.svelte';
	const { api, session } = browserContext();
	const workspace = createWorkspaceStore();
	/** The account whose projects are open; the route shows this only while one is signed in. */
	let holder = session.actor?.id ?? null;
	const show = () => {
		if (isWorkspacePath(location.pathname)) void workspace.navigate(location.pathname, false);
	};
	/** Another account takes all of the last one's projects off the page; the address is read anew. */
	function changed(id: string | null) {
		if (id === holder) return;
		holder = id;
		workspace.invalidate();
		forgetShared(workspace, everyProject, '');
		if (!id) return;
		void workspace.loadProjects();
		show();
	}
	$effect(() => {
		const id = session.actor?.id ?? null;
		untrack(() => changed(id));
	});
	/** The account still signed in has its owned and joined projects listed again. */
	async function refresh() {
		const before = session.actor?.id;
		await session.check();
		if (before && session.actor?.id === before) await workspace.loadProjects();
	}
	/** The desktop workspace over the browser bridge: shared projects only, and no local folder. */
	onMount(() => {
		workspace.connect(browserBridge(api), { local: false });
		const sync = new ProjectSyncService({ refresh });
		void workspace.loadProjects();
		show();
		sync.start();
		window.addEventListener('popstate', show);
		return () => {
			sync.stop();
			window.removeEventListener('popstate', show);
			workspace.connect(undefined);
			workspace.invalidate();
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
		><hx-section class="hub-card">
			{#if workspace.error}<hx-h1>This project could not be opened</hx-h1>
				<hx-p class="error" role="alert">{workspace.error}</hx-p>{:else}<hx-p class="muted">
					Loading project…
				</hx-p>{/if}
		</hx-section></HubFrame
	>{/if}
