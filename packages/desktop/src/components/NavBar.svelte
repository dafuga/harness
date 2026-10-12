<script lang="ts">
	import type { Snippet } from 'svelte';
	import { categories } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import Icon from './Icon.svelte';
	import ProjectSwitcher from './ProjectSwitcher.svelte';
	import RevisionPicker from './RevisionPicker.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	/** `account` is the place of a host app for who is signed in; the desktop app has none. */
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
</script>

<header class="topbar">
	<WorkspaceLink {workspace} to={workspace.path('pages')} class="brand"
		><span class="brand-mark">◈</span> Harness</WorkspaceLink
	>
	<ProjectSwitcher {workspace} />
	<nav aria-label="Catalog categories">
		{#each categories as category (category)}<WorkspaceLink
				{workspace}
				to={workspace.path(category)}
				class={workspace.category === category ? 'active' : ''}
				><Icon name={category} /><span>{category[0].toUpperCase() + category.slice(1)}</span
				></WorkspaceLink
			>{/each}
	</nav>
	<RevisionPicker {workspace} />
	{#if account}<div class="account">{@render account()}</div>{/if}
</header>
