<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import EntitySearch from '$shared/explorer-ui/entity-search/EntitySearch.svelte';
	import type { Snippet } from 'svelte';
	import { categories } from '../../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import DeploymentActivity from '../../DeploymentActivity.svelte';
	import DeploymentDialog from '../../DeploymentDialog.svelte';
	import EnvironmentPicker from '../../EnvironmentPicker.svelte';
	import Icon from '../../shared-primitives/Icon.svelte';
	import ProjectSwitcher from '../project-switcher/ProjectSwitcher.svelte';
	import RevisionPicker from '../../shared-primitives/RevisionPicker.svelte';
	import WorkspaceLink from '../WorkspaceLink.svelte';
	import { workspaceSearch } from './workspaceSearch';
	import { workspaceGameViews } from '../../../utils/projects-sessions/workspaceRoute';
	/** `account` is the place of a host app for who is signed in; the desktop app has none. */
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
	// Results open only from the projection that listed them; one left from another is refused.
	const search = $derived(workspaceSearch(workspace));
	const settings = $derived(`/settings?from=${encodeURIComponent(workspace.path())}`);
	/** Deployments are of this device's host: only a local bridge that reports them shows them. */
	const activity = $derived(workspace.local && !!workspace.bridge?.deploymentActivities);
	let tabs = $state<HTMLElement>();
	/** Where the categories scroll, as on a phone, the shown one is brought to their middle. */
	$effect(() => {
		void workspace.category;
		const shown = tabs?.querySelector('.active')?.getBoundingClientRect();
		const row = tabs?.getBoundingClientRect();
		if (!tabs || !shown || !row) return;
		tabs.scrollLeft += shown.left - row.left - (row.width - shown.width) / 2;
	});
	const gameViews = $derived(workspaceGameViews(workspace));
</script>

<!-- Focus follows the rows: project, environment and revision, categories, then search. -->
<hx-header class="topbar" class:with-account={!!account} class:with-activity={activity && !account}>
	<WorkspaceLink {workspace} to={workspace.path('pages')} class="brand"
		><hx-span class="brand-mark"><BrandMark /></hx-span>
		<hx-span class="brand-word">Harness</hx-span></WorkspaceLink
	>
	<ProjectSwitcher {workspace} />
	<EnvironmentPicker {workspace}><DeploymentDialog {workspace} /></EnvironmentPicker>
	<RevisionPicker {workspace} />
	<hx-nav aria-label="Catalog categories" bind:this={tabs}>
		{#each categories as category (category)}<WorkspaceLink
				{workspace}
				to={workspace.path(category)}
				class={workspace.category === category ? 'active' : ''}
				><Icon name={category} /><hx-span
					>{category === 'functions'
						? 'Helpers'
						: category === 'apis'
							? 'APIs'
							: category[0].toUpperCase() + category.slice(1)}</hx-span
				></WorkspaceLink
			>{/each}
		<!-- On a phone, Game Views starts a row of its own, which search and settings then end. -->
		{#if gameViews}<hx-a href={resolve(gameViews as '/')} style:grid-column="1">Game Views</hx-a
			>{/if}
	</hx-nav>
	<hx-div class="topbar-search">
		<EntitySearch
			entries={search.entries}
			scope={search.scope}
			href={(entry) => resolve((search.at(entry) ?? workspace.path()) as '/')}
			open={(entry) => {
				const path = search.at(entry);
				if (path) void workspace.navigate(path);
			}}
		/>{#if workspace.capabilities.agents}<hx-a
				class="topbar-settings"
				href={resolve(settings as '/')}
				aria-label="Settings"
				title="Settings"><Icon name="settings" /></hx-a
			>{/if}
	</hx-div>
	{#if account}<hx-div class="account">
			{@render account()}{#if activity}<DeploymentActivity {workspace} />{/if}
		</hx-div>{:else if activity}<DeploymentActivity {workspace} />{/if}
</hx-header>

<style>
	@import './nav-bar/navBar.css';
</style>
