<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hbyhwry7b7 -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import EntitySearch from '$shared/explorer-ui/entity-search/EntitySearch.svelte';
	import type { Snippet } from 'svelte';
	import { categories } from '../../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import DeploymentActivity from '../../development-tooling/DeploymentActivity.svelte';
	import DeploymentDialog from '../../development-tooling/DeploymentDialog.svelte';
	import EnvironmentPicker from '../../development-tooling/EnvironmentPicker.svelte';
	import Icon from '../../shared-primitives/Icon.svelte';
	import ProjectSwitcher from '../project-switcher/ProjectSwitcher.svelte';
	import RevisionPicker from '../../shared-primitives/RevisionPicker.svelte';
	import WorkspaceLink from '../WorkspaceLink.svelte';
	import { workspaceSearch } from './workspaceSearch';
	import { keepActiveInRow } from './keepActiveInRow';
	import { workspaceGameViews } from '../../../utils/projects-sessions/workspaceRoute';
	/** `account` is the place of a host app for who is signed in; the desktop app has none. */
	let { workspace, account }: { workspace: Workspace; account?: Snippet } = $props();
	// Results open only from the projection that listed them; one left from another is refused.
	const search = $derived(workspaceSearch(workspace));
	const settings = $derived(`/settings?from=${encodeURIComponent(workspace.path())}`);
	/** Deployments are of this device's host: only a local bridge that reports them shows them. */
	const activity = $derived(workspace.local && !!workspace.bridge?.deploymentActivities);
	const gameViews = $derived(workspaceGameViews(workspace));
	/** Offered by this computer's bridge, or by a paired phone's while it is online and signed in. */
	const overview = $derived(!!workspace.bridge?.projectOverview);
	/** The canvases of this computer's checkout: only a local project over a bridge that reads them. */
	const designs = $derived(
		workspace.local && workspace.bridge?.designCanvases && workspace.projectId
			? `/designs?projectId=${encodeURIComponent(workspace.projectId)}&from=${encodeURIComponent(workspace.path())}`
			: null
	);
</script>

<!-- Focus follows the visible rows: project and identity, context and search, then categories. -->
<hx-header
	class="topbar"
	class:has-game={!!gameViews}
	class:with-account={!!account}
	class:with-activity={activity && !account}
>
	{#if workspace.bridge?.homeSnapshot}
		<hx-a class="brand" href={resolve('/')} aria-label="Harness" data-sveltekit-reload
			><hx-span class="brand-mark"><BrandMark /></hx-span></hx-a
		>
	{:else}
		<WorkspaceLink {workspace} to={workspace.path('pages')} class="brand" label="Harness"
			><hx-span class="brand-mark"><BrandMark /></hx-span></WorkspaceLink
		>
	{/if}
	<ProjectSwitcher {workspace} />
	<hx-div class="topbar-context">
		<EnvironmentPicker {workspace}><DeploymentDialog {workspace} /></EnvironmentPicker>
		<RevisionPicker {workspace} />

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
	</hx-div>
	<hx-nav aria-label="Catalog categories" use:keepActiveInRow>
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
		{#if gameViews}<hx-a href={resolve(gameViews as '/')}
				><Icon name="game" /><hx-span>Game Views</hx-span></hx-a
			>{/if}
		{#if designs}<hx-a href={resolve(designs as '/')}><hx-span>Designs</hx-span></hx-a>{/if}
		{#if overview}<hx-a href={resolve('/projects' as '/')}><hx-span>Projects</hx-span></hx-a>{/if}
		{#if workspace.bridge?.trackerInbox}<hx-a
				data-sveltekit-reload
				href={workspace.bridge.homeSnapshot
					? resolve('/') + '?view=needs-you'
					: resolve('/tracker' as '/')}><hx-span>Needs you</hx-span></hx-a
			>{/if}
	</hx-nav>

	{#if account}<hx-div class="account">
			{@render account()}{#if activity}<DeploymentActivity {workspace} />{/if}
		</hx-div>{:else if activity}<DeploymentActivity {workspace} />{/if}
</hx-header>

<style>
	@import './nav-bar/navBar.css';
</style>
