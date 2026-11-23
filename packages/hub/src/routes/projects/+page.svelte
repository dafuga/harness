<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hubproj222 -->
<!-- @harness-view overview -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	import { ProjectSyncService } from '$desktop/services/projects-sessions/ProjectSyncService';
	import Modal from '$shared/Modal.svelte';
	import HubFrame from '../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../components/accounts-access/login-panel/LoginPanel.svelte';
	import ProjectCreate from '../../components/projects-sessions/ProjectCreate.svelte';
	import ProjectList from '../../components/projects-sessions/ProjectList.svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { readOverview, watchWhileVisible } from '../tracker-overview/overviewClient';
	import type { OverviewOutcome } from '../tracker-overview/overviewClient.types';
	const { session, projects } = browserContext();
	let list = $state<ProjectSummary[] | null>(null);
	let listFailure = $state<'setup' | 'read' | null>(null);
	/** Who the server names; the same person answered again changes nothing here. */
	const actor = $derived(session.actor?.id ?? null);
	const configured = $derived(session.status?.configured === true);
	/**
	 * What the owner endpoint answered for this account. Only an owner answer carries a snapshot, so
	 * the Project overview link is offered to the owner the server names and to nobody else. The
	 * tracker board itself lives on /tracker-overview, one click away: the list is this page's one
	 * main piece.
	 */
	let overview = $state<OverviewOutcome | null>(null);
	const owned = $derived(overview?.kind === 'owner' ? overview : null);
	/** Counts overview reads; an answer to an earlier read, or for another account, is dropped. */
	let overviewAsked = 0;
	let overviewController: AbortController | undefined;
	/** Counts list reads; one answered after a later read, another person or leaving is dropped. */
	let asked = 0;
	/** What the GitHub connection ended with. The reason for a failure is never in the address. */
	const github = new URLSearchParams(location.search).get('github');
	/** The New project form opens in a dialog over the list, never inline on this overview. */
	let creating = $state(false);
	async function readOwnerOverview(id: string) {
		const turn = ++overviewAsked;
		overviewController?.abort();
		overviewController = new AbortController();
		const value = await readOverview(fetch, overviewController.signal);
		if (turn === overviewAsked && id === actor) overview = value;
	}
	/** Asks the session again first: a different or missing account is never read for. */
	async function refreshOverview() {
		const before = actor;
		await session.check();
		if (before && actor === before) await readOwnerOverview(before);
	}
	/** Another person, or nobody, takes the overview off the page; an owner is read as soon as sign-in resolves. */
	$effect(() => {
		const id = actor;
		overview = null;
		if (!id) return;
		void readOwnerOverview(id);
		const stop = watchWhileVisible(() => void refreshOverview());
		return () => {
			overviewAsked++;
			overviewController?.abort();
			stop();
		};
	});
	async function load(id: string) {
		const turn = ++asked;
		try {
			const value = await projects.list();
			if (turn !== asked || id !== actor) return;
			list = value;
			listFailure = null;
		} catch (cause) {
			if (turn !== asked || id !== actor) return;
			listFailure =
				cause instanceof Error && 'code' in cause && cause.code === 'collaboration-disabled'
					? 'setup'
					: 'read';
		}
	}
	/** Another person, or nobody, takes the list off the page before anything else is read. */
	$effect(() => {
		const id = actor;
		list = null;
		listFailure = null;
		if (id) void load(id);
		return () => asked++;
	});
	/** Owned and joined projects of this account, read again on focus, online and each interval. */
	async function refresh() {
		const before = actor;
		await session.check();
		if (actor && actor === before) await load(actor);
	}
	/** Where sign-in is not configured nothing is asked again: the page says so and stays. */
	$effect(() => {
		if (!configured) return;
		const sync = new ProjectSyncService({ refresh });
		sync.start();
		return () => sync.stop();
	});
	function open(projectId: string) {
		location.assign(
			resolve('/projects/[projectId]/harness/[...path]', { projectId, path: 'pages' })
		);
	}
</script>

<svelte:head><title>Harness · Shared projects</title></svelte:head>
<HubFrame>
	<hx-h1>Shared projects</hx-h1>
	{#if !session.actor}<LoginPanel />{:else}
		{#if list}<hx-div class="hub-actions">
				<hx-button
					type="button"
					class="primary"
					aria-haspopup="dialog"
					onclick={() => (creating = true)}>New project</hx-button
				>
			</hx-div>{/if}
		<ProjectList projects={list} failure={listFailure} overview={Boolean(owned)} />
		{#if github === 'connected'}<hx-p class="muted" role="status">GitHub is connected.</hx-p
			>{:else if github === 'failed'}<hx-p class="error" role="alert"
				>GitHub could not be connected. Try again.</hx-p
			>{/if}
		<Modal open={creating} title="New project" variant="text" onClose={() => (creating = false)}
			><ProjectCreate created={open} /></Modal
		>
	{/if}
</HubFrame>
