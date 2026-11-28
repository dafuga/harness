<!-- @harness-tier page -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_gp2k2ksjwv -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getContext, onMount, setContext } from 'svelte';
	import { createRemoteHostStore } from '../lib/stores/networking-security/remoteHost.svelte';
	import { createRemotePhoneStore } from '../lib/stores/networking-security/remotePhone.svelte';
	import { createWorkspaceStore } from '../lib/stores/projects-sessions/workspace.svelte';
	import {
		nativeAccountContext,
		remoteContext
	} from '../models/development-tooling/Environment.types';
	import type {
		Environment,
		EnvironmentKind,
		NativeAccountContext
	} from '../models/development-tooling/Environment.types';
	import { ProjectSyncService } from '../services/projects-sessions/ProjectSyncService';
	import { isWorkspacePath } from '../utils/projects-sessions/workspaceRoute';
	import TrackerInbox from '../components/development-tooling/tracker-inbox/TrackerInbox.svelte';
	import { phoneTrackerInboxSource } from '../lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
	import ProjectGate from '../components/projects-sessions/ProjectGate.svelte';
	import DesktopHome from '../components/projects-sessions/DesktopHome.svelte';
	import RemoteConnection from '../components/networking-security/RemoteConnection.svelte';
	import WorkspaceShell from '../components/projects-sessions/WorkspaceShell.svelte';
	import '../lib/styles/workspace.css';
	import '../lib/styles/design.css';
	const account = getContext<NativeAccountContext>(nativeAccountContext);
	const inbox = $derived(
		account.environment?.tracker
			? phoneTrackerInboxSource(account.environment.tracker)
			: account.environment?.bridge?.trackerInbox
	);
	const workspace = createWorkspaceStore();
	const remote = {
		host: createRemoteHostStore(workspace),
		phone: createRemotePhoneStore(workspace)
	};
	setContext(remoteContext, remote);
	let available = $state(false);
	let kind = $state<EnvironmentKind>('web');
	const local = $derived(kind !== 'capacitor');
	const needsOnly = $derived(page.url.searchParams.get('view') === 'needs-you');
	/** The phone offers Project Overview after the Hub confirms this account may read it. */
	let overview = $state(false);
	onMount(() => {
		/** One adapter per runtime: the desktop preload, the phone's native plugin, or neither. */
		const environment = account.environment;
		if (!environment) return;
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
		const sync = new ProjectSyncService({ refresh: () => workspace.loadProjects() });
		if (account.signedIn) sync.start();
		const releaseOverview = environment.account ? offerOverview(environment) : undefined;
		void remote.host.start();
		void remote.phone.start();
		window.addEventListener('popstate', show);
		return () => {
			window.removeEventListener('popstate', show);
			releaseOverview?.();
			sync.stop();
			overview = false;
			remote.host.dispose();
			remote.phone.dispose();
			workspace.connect(undefined);
		};
	});

	function offerOverview(environment: Environment): () => void {
		const bridge = environment.bridge;
		let active = true;
		const read = bridge?.projectOverview;
		void read?.().then(
			() => {
				if (active) overview = Boolean(bridge?.projectOverview);
			},
			() => {}
		);
		const off = bridge?.onCacheStatus?.(({ status }) => {
			if (status === 'denied') overview = Boolean(bridge?.projectOverview);
		});
		return () => {
			active = false;
			off?.();
		};
	}
</script>

<svelte:head
	><title
		>Harness{workspace.snapshot
			? ' · ' + workspace.snapshot.project.name
			: needsOnly
				? ' · Needs you'
				: ''}</title
	></svelte:head
>
{#if workspace.snapshot}<WorkspaceShell {workspace} />
{:else if kind === 'electron' && account.signedIn}
	<DesktopHome
		{workspace}
		{needsOnly}
		accountName={account.accountName}
		signOut={account.signOut}
		phone={workspace.remote.host ? phoneAccess : undefined}
	/>
	{#if workspace.error}<hx-p class="error" role="alert">{workspace.error}</hx-p>{/if}
{:else}<ProjectGate
		{available}
		{local}
		{overview}
		busy={workspace.busy}
		open={() => void workspace.openProject()}
		projects={workspace.projects}
		choose={(projectId) => void workspace.switchProject(projectId)}
		phone={local && available && workspace.remote.host ? phoneAccess : undefined}
	>
		{#snippet blockers()}
			{#if inbox}<TrackerInbox source={inbox} mode={local ? 'mac' : 'phone'} home />
			{:else if kind === 'electron' || kind === 'capacitor'}
				<hx-section aria-label="Blocked - needs you"
					><hx-h2>Blocked - needs you</hx-h2><hx-p>Blockers are unavailable.</hx-p></hx-section
				>
			{/if}
		{/snippet}
		{#if inbox}
			<hx-a class="project-overview-link" href={resolve('/tracker' as '/')}>Needs you</hx-a>
		{/if}
		{#if account.environment?.trackerHome}
			<hx-a
				class="project-overview-link"
				href={resolve('/tracker' as '/') + '?view=work'}
				data-sveltekit-reload>Plans and schedule</hx-a
			>
		{/if}
		{#if available && !local}<RemoteConnection {workspace} />{/if}
		{#if account.signedIn && (local || remote.phone.status?.state !== 'online')}
			<hx-div class="account-status" class:phone-account={!local}>
				<hx-span>Signed in with Google</hx-span>
				<hx-button type="button" onclick={account.signOut}>Sign out</hx-button>
			</hx-div>
		{/if}
	</ProjectGate>{#if workspace.error}<hx-p class="error" role="alert">{workspace.error}</hx-p
		>{/if}{/if}
{#snippet phoneAccess()}<RemoteConnection {workspace} />{/snippet}

<style>
	.account-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-12);
		margin: 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
	}
	.phone-account {
		justify-content: center;
		margin-top: var(--hx-space-12);
	}
	.phone-account > :global(button) {
		min-height: 44px;
	}
</style>
