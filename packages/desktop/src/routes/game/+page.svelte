<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import GameWorkspace from '../../components/GameWorkspace.svelte';
	import type { DesktopBridge } from '../../models/DesktopBridge.types';
	import type { EnvironmentHost } from '../../models/Environment.types';
	import '../../lib/styles/workspace.css';
	import '../../lib/styles/design.css';
	const title = 'Game Views';
	let mounted = $state(false);
	let error = $state('');
	let bridge = $state.raw<DesktopBridge>();
	const query = $derived(mounted ? page.url.searchParams : null);
	const projectId = $derived(query?.get('projectId') || null);
	const commit = $derived(query?.get('commit') || undefined);
	const readonly = $derived(
		['', '1', 'true'].includes(query?.get('readonly') ?? query?.get('readOnly') ?? 'false')
	);
	/** Only the desktop app provides the bridge; anywhere else the workspace is a demo. */
	async function connect() {
		const host = (window as Window & EnvironmentHost).harness;
		try {
			const id = page.url.searchParams.get('projectId');
			if (id && host?.selectProject) await host.selectProject({ projectId: id });
			const at = page.url.searchParams.get('commit');
			if (id && at && host?.snapshot)
				await host.snapshot({ projectId: id, branch: null, commit: at });
			bridge = host;
			mounted = true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Cannot open this game.';
		}
	}
	onMount(() => {
		void connect();
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="game-page" data-harness-view="game">
	{#if error}<h1>Game Views</h1>
		<p role="alert">{error}</p>{/if}
	{#if mounted}
		<GameWorkspace {projectId} {commit} {readonly} {bridge} />
	{/if}
</main>

<style>
	.game-page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 24px 48px;
	}
</style>
