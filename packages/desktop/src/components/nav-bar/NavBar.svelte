<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import EntitySearch from '$shared/entity-search/EntitySearch.svelte';
	import type { Snippet } from 'svelte';
	import { categories } from '../../models/Desktop.types';
	import type { Workspace } from '../../lib/stores/workspace.svelte';
	import DeploymentActivity from '../DeploymentActivity.svelte';
	import DeploymentDialog from '../DeploymentDialog.svelte';
	import EnvironmentPicker from '../EnvironmentPicker.svelte';
	import Icon from '../Icon.svelte';
	import ProjectSwitcher from '../project-switcher/ProjectSwitcher.svelte';
	import RevisionPicker from '../RevisionPicker.svelte';
	import WorkspaceLink from '../WorkspaceLink.svelte';
	import { workspaceSearch } from './workspaceSearch';
	/** `account` is the place of a host app for who is signed in; the desktop app has none. */
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
	// Results open only from the projection that listed them; one left from another is refused.
	const search = $derived(workspaceSearch(workspace));
	const settings = $derived(`/settings?from=${encodeURIComponent(workspace.path())}`);
	/** Deployments are of this device's host: only a local bridge that reports them shows them. */
	const activity = $derived(workspace.local && !!workspace.bridge?.deploymentActivities);
</script>

<header class="topbar" class:with-account={!!account} class:with-activity={activity && !account}>
	<WorkspaceLink {workspace} to={workspace.path('pages')} class="brand"
		><span class="brand-mark"><BrandMark /></span> Harness</WorkspaceLink
	>
	<ProjectSwitcher {workspace} />
	<nav aria-label="Catalog categories">
		{#each categories as category (category)}<WorkspaceLink
				{workspace}
				to={workspace.path(category)}
				class={workspace.category === category ? 'active' : ''}
				><Icon name={category} /><span
					>{category === 'functions'
						? 'Helpers'
						: category[0].toUpperCase() + category.slice(1)}</span
				></WorkspaceLink
			>{/each}
	</nav>
	<EnvironmentPicker {workspace}><DeploymentDialog {workspace} /></EnvironmentPicker>
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
	{#if account}<div class="account">
			{@render account()}{#if activity}<DeploymentActivity {workspace} />{/if}
		</div>{:else if activity}<DeploymentActivity {workspace} />{/if}
</header>

<style>
	/* Settings end the search's own place, so they never take a row of their own. */
	.topbar-search {
		gap: 8px;
	}
	.topbar-settings {
		display: inline-grid;
		place-items: center;
		flex: none;
		align-self: center;
		margin-inline-start: auto;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: inherit;
	}
	.topbar-settings:hover,
	.topbar :global(.agent-icon:hover:not(:disabled)) {
		color: var(--gold);
		border-color: var(--gold);
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
	/* Environment and revision share the first row; catalog and search share the last. */
	@media (min-width: 561px) {
		header.topbar {
			--search: clamp(168px, 100% - 540px, 468px); /* left by 6 × 86px categories and a reserve */
			display: grid;
			grid-template:
				'brand project . environment revision' auto
				'tools tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr minmax(0, max-content) auto;
			gap: 8px 16px;
			padding: 12px 26px 0;
		}
		header.topbar.with-account,
		header.topbar.with-activity {
			grid-template:
				'brand project . environment revision account' auto
				'tools tools tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr minmax(0, max-content) auto auto;
		}
		.topbar :global(.brand) {
			grid-area: brand;
		}
		.topbar :global(.project-switcher) {
			grid-area: project;
		}
		.topbar :global(.revision-picker) {
			grid-area: revision;
			margin-left: 0;
		}
		.topbar :global(.environment-picker) {
			grid-area: environment;
			justify-self: end;
		}
		.account,
		.topbar > :global(.deployment-activity) {
			grid-area: account;
		}
		/* The categories are tabs on the bar's bottom edge. */
		.topbar nav {
			grid-area: tools;
			justify-self: start;
			justify-content: flex-start;
			width: auto;
			height: 58px;
		}
		.topbar-search {
			grid-area: tools;
			justify-self: end;
			width: var(--search);
			max-width: none;
			padding-bottom: 0;
		}
		.topbar-search :global(.entity-search) {
			max-width: none;
		}
	}
	/* At narrower widths, environment and revision share a row below the project. */
	@media (min-width: 561px) and (max-width: 1250px) {
		header.topbar.with-account {
			grid-template:
				'brand project . account' auto
				'revision revision environment revision' auto
				'tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr auto;
		}
		.with-account :global(.revision-picker) {
			border-left: 0;
			padding-left: 0;
		}
	}
	@media (min-width: 561px) and (max-width: 900px) {
		header.topbar,
		header.topbar.with-activity {
			grid-template:
				'brand project . account' auto
				'revision revision environment revision' auto
				'tools tools tools tools' auto
				/ auto minmax(0, max-content) 1fr auto;
		}
		.topbar :global(.revision-picker) {
			border-left: 0;
			padding-left: 0;
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
				/ auto minmax(0, max-content) auto 1fr max-content auto minmax(168px, 388px);
			column-gap: 22px;
			padding: 0 26px;
		}
		header.topbar.with-activity {
			grid-template:
				'brand project tools . environment revision search account' auto
				/ auto minmax(0, max-content) auto 1fr max-content auto minmax(168px, 388px) auto;
		}
		.topbar:not(.with-account) nav {
			height: auto;
		}
		.topbar:not(.with-account) .topbar-search {
			grid-area: search;
			width: 100%;
		}
	}
	/* On a phone the deployment light ends the brand's row, the brand still centred on the bar. */
	@media (max-width: 560px) {
		.with-activity :global(.brand) {
			order: -2;
			flex: 1;
			padding-inline-start: 46px;
		}
	}
</style>
