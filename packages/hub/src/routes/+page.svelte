<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	import { ProjectSyncService } from '$desktop/services/ProjectSyncService';
	import HubFrame from '../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../components/accounts-access/login-panel/LoginPanel.svelte';
	import ProjectCreate from '../components/projects-sessions/ProjectCreate.svelte';
	import ProjectList from '../components/projects-sessions/ProjectList.svelte';
	import { browserContext } from '../utils/development-tooling/browserContext';
	const { session, projects } = browserContext();
	let list = $state<ProjectSummary[] | null>(null);
	let error = $state('');
	/** Who the server names; the same person answered again changes nothing here. */
	const actor = $derived(session.actor?.id ?? null);
	const configured = $derived(session.status?.configured === true);
	/** Counts list reads; one answered after a later read, another person or leaving is dropped. */
	let asked = 0;
	/** What the GitHub connection ended with. The reason for a failure is never in the address. */
	const github = new URLSearchParams(location.search).get('github');
	async function load(id: string) {
		const turn = ++asked;
		try {
			const value = await projects.list();
			if (turn !== asked || id !== actor) return;
			list = value;
			error = '';
		} catch (cause) {
			if (turn === asked && id === actor) error = String(cause);
		}
	}
	/** Another person, or nobody, takes the list off the page before anything else is read. */
	$effect(() => {
		const id = actor;
		list = null;
		error = '';
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
	<h1>Shared projects</h1>
	{#if !session.actor}<LoginPanel />{:else}{#if github === 'connected'}<p role="status">
				GitHub is connected.
			</p>{:else if github === 'failed'}<p class="error" role="alert">
				GitHub could not be connected. Try again.
			</p>{/if}{#if error}<p class="error" role="alert">{error}</p>{/if}{#if list}<ProjectList
				projects={list}
			/>{:else if !error}<p class="muted">Loading projects…</p>{/if}<ProjectCreate
			created={open}
		/>{/if}
</HubFrame>
