<!-- @harness-tier page -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { createRemoteHostStore } from '../lib/stores/networking-security/remoteHost.svelte';
	import { createRemotePhoneStore } from '../lib/stores/networking-security/remotePhone.svelte';
	import { createWorkspaceStore } from '../lib/stores/projects-sessions/workspace.svelte';
	import { remoteContext } from '../models/development-tooling/Environment.types';
	import type {
		EnvironmentHost,
		EnvironmentKind
	} from '../models/development-tooling/Environment.types';
	import { selectEnvironment } from '../lib/verification-evidence/select-environment/selectEnvironment';
	import { isWorkspacePath } from '../utils/projects-sessions/workspaceRoute';
	import HostedConnection from '../components/networking-security/HostedConnection.svelte';
	import ProjectGate from '../components/projects-sessions/ProjectGate.svelte';
	import RemoteConnection from '../components/networking-security/RemoteConnection.svelte';
	import WorkspaceShell from '../components/projects-sessions/WorkspaceShell.svelte';
	import '../lib/styles/workspace.css';
	import '../lib/styles/design.css';
	const workspace = createWorkspaceStore();
	const remote = {
		host: createRemoteHostStore(workspace),
		phone: createRemotePhoneStore(workspace)
	};
	setContext(remoteContext, remote);
	let available = $state(false);
	let kind = $state<EnvironmentKind>('web');
	onMount(() => {
		/** One adapter per runtime: the desktop preload, the phone's native plugin, or neither. */
		const environment = selectEnvironment(window as unknown as EnvironmentHost);
		kind = environment.kind;
		document.documentElement.dataset.environment = kind;
		workspace.connect(environment.bridge, environment);
		available = Boolean(environment.bridge);
		const show = () => {
			if (isWorkspacePath(location.pathname)) void workspace.navigate(location.pathname, false);
		};
		/**
		 * A phone reads nothing of a computer before it is reached; its connection starts those
		 * reads. The phone's own Hub account is read at once, paired or not.
		 */
		if (environment.bridge && (!environment.phone || environment.account)) {
			void workspace.loadProjects();
			show();
		}
		void remote.host.start();
		void remote.phone.start();
		window.addEventListener('popstate', show);
		return () => {
			window.removeEventListener('popstate', show);
			remote.host.dispose();
			remote.phone.dispose();
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
		local={kind !== 'capacitor'}
		busy={workspace.busy}
		open={() => void workspace.openProject()}
		projects={workspace.projects}
		choose={(projectId) => void workspace.switchProject(projectId)}
		>{#if available}<HostedConnection {workspace} /><RemoteConnection
				{workspace}
			/>{/if}</ProjectGate
	>{#if workspace.error}<hx-p class="error" role="alert">{workspace.error}</hx-p>{/if}{/if}
