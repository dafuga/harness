<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import CatalogView from './CatalogView.svelte';
	import EntityView from './entity-view/EntityView.svelte';
	import NavBar from './nav-bar/NavBar.svelte';
	import ProjectAgent from './ProjectAgent.svelte';
	import StatusBar from './StatusBar.svelte';
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
</script>

<!-- Views are rebuilt per project: an open thread, image or dialog never moves to another one. -->
<div class="workspace">
	<NavBar {workspace} {account} />{#if workspace.error}<p class="error" role="alert">
			{workspace.error}
		</p>{/if}{#if workspace.entity}{#key `${workspace.projectId}:${workspace.entity.id}`}<EntityView
				{workspace}
			/>{/key}{:else}{#key workspace.projectId}<CatalogView {workspace} />{/key}{/if}<StatusBar
		{workspace}
	/>
	<!-- One conversation per project: it stays through entities, history and pinned commits, and
	     a request never follows to another project. -->
	{#key workspace.projectId}<ProjectAgent {workspace} />{/key}
</div>
