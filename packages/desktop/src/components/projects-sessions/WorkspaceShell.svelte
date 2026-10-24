<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import CatalogView from '../explorer-ui/CatalogView.svelte';
	import EntityView from '../explorer-ui/entity-view/EntityView.svelte';
	import NavBar from './nav-bar/NavBar.svelte';
	import ProjectAgent from '../agents-providers/ProjectAgent.svelte';
	import StatusBar from '../shared-primitives/StatusBar.svelte';
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
</script>

<!-- Views are rebuilt per project: an open thread, image or dialog never moves to another one. -->
<hx-div class="workspace">
	<NavBar {workspace} {account} />{#if workspace.error}<hx-p class="error" role="alert">
			{workspace.error}
		</hx-p>{/if}{#if workspace.entity}{#key `${workspace.projectId}:${workspace.entity.id}`}<EntityView
				{workspace}
			/>{/key}{:else}{#key workspace.projectId}<CatalogView {workspace} />{/key}{/if}<StatusBar
		{workspace}
	/>
	<!-- One conversation per project: it stays through entities, history and pinned commits, and
	     a request never follows to another project. -->
	{#key workspace.projectId}<ProjectAgent {workspace} />{/key}
</hx-div>
