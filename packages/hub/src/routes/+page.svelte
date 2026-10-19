<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectSummary } from 'collaboration';
	import HubFrame from '../components/HubFrame.svelte';
	import LoginPanel from '../components/LoginPanel.svelte';
	import ProjectCreate from '../components/ProjectCreate.svelte';
	import ProjectList from '../components/ProjectList.svelte';
	import { browserContext } from '../utils/browserContext';
	const { session, projects } = browserContext();
	let list = $state<ProjectSummary[] | null>(null);
	let error = $state('');
	/** What the GitHub connection ended with. The reason for a failure is never in the address. */
	const github = new URLSearchParams(location.search).get('github');
	$effect(() => {
		list = null;
		error = '';
		if (session.actor)
			void projects
				.list()
				.then((value) => (list = value))
				.catch((cause: unknown) => (error = String(cause)));
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
			</p>{/if}{#if error}<p class="error" role="alert">{error}</p>{:else if list}<ProjectList
				projects={list}
			/>{:else}<p class="muted">Loading projects…</p>{/if}<ProjectCreate created={open} />{/if}
</HubFrame>
