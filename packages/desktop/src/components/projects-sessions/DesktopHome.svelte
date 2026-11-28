<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_k36nzpchr3 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, setContext, tick, type Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Modal from '$shared/Modal.svelte';
	import type { LoadSpecDocument } from '$shared/explorer-ui/explorer-kit/SpecDocumentView.types';
	import type {
		HomeChatReceipt,
		HomeSection,
		OwnerHomeSnapshot
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
	import HubHomeHeader from '$reports/components/projects-sessions/hub-home/HubHomeHeader.svelte';
	import HubHomeCards from '$reports/components/projects-sessions/hub-home/HubHomeCards.svelte';
	import HubHomeLive from '$reports/components/projects-sessions/hub-home/HubHomeLive.svelte';
	import HubHomeDialogs from '$reports/components/projects-sessions/hub-home/HubHomeDialogs.svelte';
	import { provideHomeCosChat } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.svelte';
	import { hubSpecDocumentKey } from '$reports/components/projects-sessions/hub-home/hubSpecDocument';
	import type { SendHomeChat } from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
	import '$reports/lib/styles/home-scheme.css';
	import '$reports/lib/styles/hub-home/index.css';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { followTrackerSource } from '../../lib/development-tooling/tracker-inbox/followTrackerSource';
	import { ProjectSyncService } from '../../services/projects-sessions/ProjectSyncService';
	import { desktopHomeView } from '../../utils/projects-sessions/desktopHomeView';
	import GameCreate from '../game-authoring/GameCreate.svelte';
	let {
		workspace,
		accountName,
		signOut,
		phone,
		needsOnly = false
	}: {
		workspace: Workspace;
		accountName?: string;
		signOut: () => void;
		phone?: Snippet;
		needsOnly?: boolean;
	} = $props();
	let home = $state.raw<OwnerHomeSnapshot | null>(null);
	let settled = $state(false);
	let now = $state(Date.now());
	let link = $state<RealtimeState | null>(null);
	let selected = $state<HomeSection | null>(null);
	let agentId = $state<string>();
	let dialog = $state<'create' | 'devices' | null>(null);
	let opener: HTMLElement | null = null;
	let active = true;
	const receipts = new SvelteMap<string, HomeChatReceipt>();
	const sync = new ProjectSyncService({ refresh });
	provideHomeCosChat(() => void sync.sync());
	setContext<LoadSpecDocument>(hubSpecDocumentKey, async (attachment) => {
		const ask = home?.openAsks?.find((entry) =>
			entry.attachments?.some(({ id }) => id === attachment.id)
		);
		if (!ask) return null;
		const detail = await workspace.bridge?.trackerInbox?.detail(ask.itemId);
		return (
			detail?.value?.flag?.attachments?.find(({ id }) => id === attachment.id)?.content ?? null
		);
	});
	const view = $derived(desktopHomeView(home, workspace, settled, now));
	async function refresh() {
		const snapshot = await workspace.bridge?.homeSnapshot?.().catch(() => null);
		if (!active) return;
		home = snapshot ?? null;
		settled = true;
		now = Date.now();
	}
	const send: SendHomeChat = async (input) => {
		const result = (await workspace.bridge?.homeChat?.(input)) ?? {
			id: input.id,
			status: 'refused'
		};
		receipts.set(result.id, result);
		void sync.sync();
		return result;
	};
	const receipt = async (id: string): Promise<HomeChatReceipt> =>
		receipts.get(id) ?? { id, status: 'unconfirmed' };

	function open(section: HomeSection, id?: string) {
		if (!selected && document.activeElement instanceof HTMLElement) opener = document.activeElement;
		agentId = id;
		selected = section;
	}

	function close() {
		const target = opener;
		selected = null;
		opener = null;
		void tick().then(() => target?.focus());
	}

	onMount(() => {
		sync.start();
		void sync.sync();
		const source = workspace.bridge?.trackerInbox;
		const stop =
			source &&
			followTrackerSource(source, {
				refresh: () => sync.sync(),
				state: (state) => (link = state)
			});
		return () => {
			active = false;
			stop?.();
			sync.stop();
		};
	});
</script>

<hx-div class="home-scheme">
	<hx-div class="home-page hh-home">
		<HubHomeHeader
			{view}
			localMachines={home?.liveOverview?.machines}
			{link}
			{accountName}
			{accountMenu}
			{needsOnly}
			needsHref={resolve('/') + '?view=needs-you'}
		/>
		<hx-main
			class="po-page hh-page"
			data-harness-component="desktop-home"
			aria-labelledby="hh-title"
		>
			<HubHomeCards {view} {open} {send} {receipt} {needsOnly} />
			{#if !needsOnly && home?.liveOverview}<HubHomeLive
					reading={null}
					{now}
					local={home.liveOverview}
					pastDue={view.pastDue}
				/>{/if}
			<hx-div class="gate-actions" aria-label="Project and account actions">
				{#if needsOnly}
					<hx-a class="po-action" href={resolve('/tracker')}>All Tracker items</hx-a>
				{:else}
					<hx-button
						type="button"
						class="po-action"
						disabled={workspace.busy}
						onclick={() => void workspace.openProject()}>Open project</hx-button
					>
					<hx-button
						type="button"
						class="po-action"
						aria-haspopup="dialog"
						onclick={() => (dialog = 'create')}>New project</hx-button
					>
					<hx-a class="po-action" href={resolve('/projects')}>Project Overview</hx-a>
				{/if}
			</hx-div>
		</hx-main>
		{#if selected}
			<HubHomeDialogs
				{selected}
				{view}
				{agentId}
				{open}
				{send}
				{receipt}
				reload={() => {
					void sync.sync();
					void workspace.loadProjects();
				}}
				{close}
			/>
		{/if}
		<Modal
			open={dialog === 'create'}
			title="New project"
			variant="text"
			onClose={() => (dialog = null)}
		>
			<GameCreate />
		</Modal>
		<Modal
			open={dialog === 'devices'}
			title="Linked devices"
			variant="text"
			onClose={() => (dialog = null)}
		>
			{@render phone?.()}
		</Modal>
	</hx-div>
</hx-div>

{#snippet accountMenu()}
	<hx-p class="native-account-status">Signed in with Google</hx-p>
	{#if phone}
		<hx-button
			type="button"
			class="po-action"
			aria-haspopup="dialog"
			onclick={() => (dialog = 'devices')}
		>
			Linked devices
		</hx-button>
	{/if}
	<hx-button type="button" class="po-action" onclick={signOut}>Sign out</hx-button>
{/snippet}

<style>
	.gate-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-12);
		margin-block-start: var(--hx-space-24);
	}
	.native-account-status {
		margin-block-end: var(--hx-space-8);
		color: var(--hx-color-text-supporting);
		white-space: nowrap;
	}
</style>
