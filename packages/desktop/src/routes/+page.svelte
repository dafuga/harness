<!-- @harness-tier page -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_gp2k2ksjwv -->
<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { createRemoteHostStore } from '../lib/stores/networking-security/remoteHost.svelte';
	import { createRemotePhoneStore } from '../lib/stores/networking-security/remotePhone.svelte';
	import { createWorkspaceStore } from '../lib/stores/projects-sessions/workspace.svelte';
	import { remoteContext } from '../models/development-tooling/Environment.types';
	import type {
		Environment,
		EnvironmentHost,
		EnvironmentKind,
		RemoteMobileStatus
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
	/** On a paired phone: offered only once the owner's overview read confirms this account may see it. */
	let overview = $state(false);
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
		const releases = environment.phone ? offerOverview(environment) : [];
		void remote.host.start();
		void remote.phone.start();
		window.addEventListener('popstate', show);
		return () => {
			window.removeEventListener('popstate', show);
			releases.forEach((release) => release());
			overview = false;
			remote.host.dispose();
			remote.phone.dispose();
			workspace.connect(undefined);
		};
	});

	/**
	 * The Project Overview link on a paired phone. Each change of pairing or account is asked again:
	 * the link is hidden at once and shown only when the fixed overview read answers 200 or 503. An
	 * answer that arrives after a further change is discarded.
	 */
	function offerOverview(environment: Environment): Array<() => void> {
		const bridge = environment.bridge;
		let ticket = 0;
		let pairing: string | null = null;
		const ask = async () => {
			const asked = ++ticket;
			overview = false;
			await bridge?.hostedStatus?.().catch(() => undefined);
			const read = bridge?.projectOverview;
			if (!read || asked !== ticket) return;
			await read().catch(() => undefined);
			if (asked === ticket) overview = Boolean(bridge?.projectOverview);
		};
		const follow = (status: RemoteMobileStatus) => {
			const key = status.state === 'online' ? (status.host?.id ?? 'online') : '';
			if (key === pairing) return;
			pairing = key;
			void ask();
		};
		const phone = environment.phone!;
		const release = phone.onStatus(follow);
		const cache = bridge?.onCacheStatus?.((status) => {
			if (status.status === 'denied') void ask();
		});
		void phone.status().then(follow, () => void ask());
		return [
			() => {
				ticket++;
				release();
			},
			() => cache?.()
		];
	}
</script>

<svelte:head
	><title>Harness{workspace.snapshot ? ' · ' + workspace.snapshot.project.name : ''}</title
	></svelte:head
>
{#if workspace.snapshot}<WorkspaceShell {workspace} />{:else}<ProjectGate
		{available}
		local={kind !== 'capacitor'}
		{overview}
		busy={workspace.busy}
		open={() => void workspace.openProject()}
		projects={workspace.projects}
		choose={(projectId) => void workspace.switchProject(projectId)}
		>{#if available}<HostedConnection {workspace} /><RemoteConnection
				{workspace}
			/>{/if}</ProjectGate
	>{#if workspace.error}<hx-p class="error" role="alert">{workspace.error}</hx-p>{/if}{/if}
