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
	/* Settings end the search's own place, so they never take a row of their own. */
	.topbar-search {
		gap: var(--hx-space-8);
	}
	.topbar-settings {
		display: inline-grid;
		place-items: center;
		flex: none;
		align-self: center;
		width: 40px;
		height: 40px;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		color: inherit;
	}
	.topbar-settings:hover,
	.topbar :global(.agent-icon:hover:not(:disabled)) {
		color: var(--hx-color-primary);
		border-color: var(--hx-color-primary);
	}
	/* Project, branch, commit, Deploy and Deployments are icons of one size; each opens a dialog. */
	.topbar :global(.agent-icon) {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 34px;
		height: 34px;
		padding: 0;
	}
	/* Each part has one named place at every width; each layout arranges the places. */
	header.topbar {
		display: grid;
	}
	.topbar :global(.brand) {
		grid-area: brand;
	}
	.topbar :global(.project-switcher) {
		grid-area: project;
	}
	.topbar :global(.environment-picker) {
		grid-area: environment;
	}
	.topbar :global(.revision-picker) {
		grid-area: revision;
	}
	.topbar nav {
		grid-area: tools;
	}
	.account,
	.topbar > :global(.deployment-activity) {
		grid-area: account;
	}
	/* Environment and revision share the first row; catalog and search share the last. */
	@media (min-width: 561px) {
		header.topbar {
			grid-template:
				'brand project . environment revision' auto
				'tools tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr minmax(0, max-content) auto;
			gap: var(--hx-space-8) var(--hx-space-16);
			padding: var(--hx-space-12) var(--hx-space-26) 0;
		}
		header.topbar.with-account,
		header.topbar.with-activity {
			grid-template:
				'brand project . environment revision account' auto
				'tools tools tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr minmax(0, max-content) auto auto;
		}
		.topbar :global(.environment-picker) {
			justify-self: end;
		}
		/* The categories are tabs on the bar's bottom edge. */
		.topbar nav {
			justify-self: start;
			justify-content: flex-start;
			width: auto;
			height: 58px;
		}
		.topbar-search {
			grid-area: tools;
			justify-self: end;
			width: max-content;
		}
	}
	/* Narrower, the environment and the revision take a row of their own under the project. */
	@media (min-width: 561px) and (max-width: 1250px) {
		header.topbar.with-account {
			grid-template:
				'brand project . account' auto
				'environment environment environment revision' auto
				'tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr auto;
		}
	}
	@media (min-width: 561px) and (max-width: 900px) {
		header.topbar,
		header.topbar.with-activity {
			grid-template:
				'brand project . account' auto
				'environment environment environment revision' auto
				'tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr auto;
		}
	}
	/* Narrower still, the search takes that row and the categories end the bar under it. */
	@media (min-width: 561px) and (max-width: 760px) {
		.topbar nav {
			grid-area: 4 / 1 / 5 / -1;
		}
		.topbar-search {
			width: 100%;
		}
	}
	/* Wide enough, a bar without an account is one row, the categories after the project. */
	@media (min-width: 1800px) {
		header.topbar:not(.with-account) {
			grid-template:
				'brand project tools . environment revision search' auto
				/ auto minmax(0, max-content) auto 1fr max-content auto max-content;
			column-gap: var(--hx-space-22);
			padding: 0 var(--hx-space-26);
		}
		header.topbar.with-activity {
			grid-template:
				'brand project tools . environment revision search account' auto
				/ auto minmax(0, max-content) auto 1fr max-content auto max-content auto;
		}
		.topbar:not(.with-account) nav {
			height: auto;
		}
		.topbar:not(.with-account) .topbar-search {
			grid-area: search;
			width: 100%;
		}
	}
	/* A phone arranges the same places in rows of its own, in responsive.css. */
</style>
