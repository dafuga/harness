<script lang="ts">
	import { onMount } from 'svelte';
	import type { DesktopBridge } from '../models/DesktopBridge.types';
	import { createWorkspaceStore } from '../lib/stores/workspace.svelte';
	import NavBar from '../components/NavBar.svelte';
	import ProjectGate from '../components/ProjectGate.svelte';
	import CatalogView from '../components/CatalogView.svelte';
	import EntityView from '../components/EntityView.svelte';
	import StatusBar from '../components/StatusBar.svelte';
	import '../lib/styles/workspace.css';
	import '../lib/styles/design.css';
	const workspace = createWorkspaceStore();
	let available = $state(false);
	onMount(() => {
		const bridge = (window as Window & { harness?: DesktopBridge }).harness;
		workspace.connect(bridge);
		available = Boolean(bridge);
		if (bridge && location.pathname.startsWith('/harness/'))
			void workspace.navigate(location.pathname, false);
		const pop = () => void workspace.navigate(location.pathname, false);
		window.addEventListener('popstate', pop);
		return () => window.removeEventListener('popstate', pop);
	});
</script>

<svelte:head
	><title>Harness{workspace.snapshot ? ' · ' + workspace.snapshot.project.name : ''}</title
	></svelte:head
>
{#if workspace.snapshot}<div class="workspace">
		<NavBar {workspace} />{#if workspace.error}<p class="error" role="alert">
				{workspace.error}
			</p>{/if}{#if workspace.entity}{#key workspace.entity.id}<EntityView
					{workspace}
				/>{/key}{:else}<CatalogView {workspace} />{/if}<StatusBar {workspace} />
	</div>{:else}<ProjectGate
		{available}
		busy={workspace.busy}
		open={() => void workspace.openProject()}
	/>{#if workspace.error}<p class="error" role="alert">{workspace.error}</p>{/if}{/if}
