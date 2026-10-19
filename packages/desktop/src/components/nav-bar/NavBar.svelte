<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import EntitySearch from '$shared/EntitySearch.svelte';
	import type { Snippet } from 'svelte';
	import { categories } from '../../models/Desktop.types.ts';
	import type { Workspace } from '../../lib/stores/workspace.svelte.ts';
	import Icon from '../Icon.svelte';
	import ProjectSwitcher from '../project-switcher/ProjectSwitcher.svelte';
	import RevisionPicker from '../RevisionPicker.svelte';
	import WorkspaceLink from '../WorkspaceLink.svelte';
	import { workspaceSearch } from './workspaceSearch';
	/** `account` is the place of a host app for who is signed in; the desktop app has none. */
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
	// Results open only from the projection that listed them; one left from another is refused.
	const search = $derived(workspaceSearch(workspace));
	/** Settings are of this device's agents, so they are offered only where agents can run. */
	const settings = $derived(`/settings?from=${encodeURIComponent(workspace.path())}`);
</script>

<header class="topbar">
	<WorkspaceLink {workspace} to={workspace.path('pages')} class="brand"
		><span class="brand-mark"><BrandMark /></span> Harness</WorkspaceLink
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
	<div class="topbar-search">
		<EntitySearch
			entries={search.entries}
			scope={search.scope}
			href={(entry) => resolve((search.at(entry) ?? workspace.path()) as '/')}
			open={(entry) => {
				const path = search.at(entry);
				if (path) void workspace.navigate(path);
			}}
		/>{#if workspace.capabilities.agents}<a
				class="topbar-settings"
				href={resolve(settings as '/')}
				aria-label="Settings"
				title="Settings"><Icon name="settings" /></a
			>{/if}
	</div>
	{#if account}<div class="account">{@render account()}</div>{/if}
</header>

<style>
	/* Settings sit beside the search icon, at its size, so the two never part. */
	.topbar-settings {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: inherit;
	}
	.topbar-settings:hover {
		color: var(--gold);
		border-color: var(--gold);
	}
</style>
