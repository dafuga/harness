<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import EmptyState from '../explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '../explorer-ui/explorer-kit/Pill.svelte';
	import DataTable from '../shared-primitives/DataTable.svelte';
	import Card from '../explorer-ui/explorer-kit/Card.svelte';
	import './ExplorerPermissionsScreen.css';
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import EntityLink from '../explorer-ui/EntityLink.svelte';
	import ExplorerFrame from '../explorer-ui/ExplorerFrame.svelte';
	import type {
		ApiGrant,
		DataGrant,
		GrantOfKind,
		ExplorerPermissionsScreenProps,
		ProfileEntry,
		ProfileGrant
	} from './ExplorerPermissionsScreen.types';
	let host: ExplorerPermissionsScreenProps = $props();
	let navigation = $derived({ route: host.route, href: host.lens.href, go: host.onroute });
	// Only the shown revision's own declarations: no profile inherits or implies another's access.
	let catalog = $derived(host.head.permissions);
	let profiles = $derived(catalog?.profiles ?? []);
	let shown = $derived(profiles.find((profile) => profile.id === host.route.entity));
	// An absent catalog is not an empty one: an older revision may predate permission profiles.
	let none = $derived(catalog ? 'No profiles are declared' : 'No permission catalog is indexed');
	// Every declaration naming the endpoint, each under the profile that makes it.
	let declared = $derived(
		profiles.flatMap((profile) =>
			grants(profile, 'api')
				.filter((grant) => grant.resource === host.endpoint)
				.map((grant) => ({ profile, grant }))
		)
	);
	function grants<K extends ProfileGrant['kind']>(profile: ProfileEntry, kind: K) {
		return profile.grants.filter((grant): grant is GrantOfKind<K> => grant.kind === kind);
	}
	/** A profile screen at the shown branch and commit; no helper, section or tab is carried over. */
	function at(entity?: string): ExplorerLocation {
		const { branch, commit } = host.route;
		const to: ExplorerLocation = { branch, commit, category: 'pages', screen: 'permissions' };
		return entity ? { ...to, entity } : to;
	}
	/** The page of a unit this revision registers, under its own category; null for any other ID. */
	function unit(id: string): ExplorerLocation | null {
		const entity = host.entities.find((item) => item.id === id);
		const { branch, commit } = host.route;
		return entity ? { branch, commit, category: entity.category, entity: id } : null;
	}
</script>

{#snippet link(to: ExplorerLocation, text: string, code = false)}
	<EntityLink {to} nav={navigation}
		>{#if code}<hx-code>{text}</hx-code>{:else}{text}{/if}</EntityLink
	>
{/snippet}

<!-- A unit links only where this revision registers it; any other ID is shown exactly. -->
{#snippet ref(id: string)}
	{@const to = unit(id)}
	{#if to}{@render link(to, id, true)}{:else}<hx-code>{id}</hx-code>{/if}
{/snippet}

<!-- What the specification declares, not what a running application enforces. -->
{#snippet heading(text: string, id: string, top: boolean)}
	<hx-header class="ex-head-title">
		{#if top}<hx-h1 {id}>{text}</hx-h1>{:else}<hx-h2 {id}>{text}</hx-h2>{/if}
		<Pill as="span" variant="explorer" tone="explorer-permissions-screen-ex-pill"
			>Declared policy</Pill
		>
	</hx-header>
{/snippet}

{#snippet gaps()}
	{#if catalog?.gaps.length}
		<hx-p class="ex-note" role="note">May be incomplete: {catalog.gaps.join('; ')}</hx-p>
	{/if}
{/snippet}

{#snippet data(rows: DataGrant[], label: string)}
	{#if rows.length}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable table must be keyboard reachable.) -->
		<DataTable {label} tableClass="ex-table" className="ex-scroll permission-data">
			{#snippet header()}
				<hx-tr>
					<hx-th scope="col">Model</hx-th>
					<hx-th scope="col">Actions</hx-th>
					<hx-th scope="col">Fields</hx-th>
					<hx-th scope="col">Scope</hx-th>
				</hx-tr>
			{/snippet}
			{#snippet children()}
				{#each rows as row, position (position)}
					<hx-tr>
						<hx-th scope="row">{@render ref(row.resource)}</hx-th>
						<hx-td data-label="Actions">{row.actions.join(', ')}</hx-td>
						<hx-td data-label="Fields"><hx-code>{row.fields.join(', ')}</hx-code></hx-td>
						<hx-td data-label="Scope">{row.scope}</hx-td>
					</hx-tr>
				{/each}
			{/snippet}
		</DataTable>
	{:else}
		<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty"
			>No data access declared.</EmptyState
		>
	{/if}
{/snippet}

{#snippet access(grant: ApiGrant, label: string)}
	<hx-ul class="ex-links inline" aria-label="HTTP methods">
		{#each grant.actions as method, place (place)}<Pill
				as="li"
				variant="explorer"
				tone="explorer-permissions-screen-ex-pill">{method}</Pill
			>{/each}
	</hx-ul>
	{@render data(grant.data, label)}
{/snippet}

<!-- Drawn inside the endpoint's own frame, so it opens no frame of its own. -->
{#snippet panel()}
	<Card
		as="section"
		labelledby="perm-api"
		component="networking-security-explorer-permissions-screen"
	>
		{@render heading('Permissions', 'perm-api', false)}
		{@render gaps()}
		{#each declared as { profile, grant }, position (position)}
			<hx-article class="ex-stack">
				<hx-h3>{@render link(at(profile.id), profile.title)}</hx-h3>
				{@render access(grant, `${profile.title} data access`)}
			</hx-article>
		{:else}
			<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty">
				{catalog ? 'No access declaration names this endpoint' : none} at this revision.
			</EmptyState>
		{/each}
	</Card>
{/snippet}

{#snippet index()}
	{@render heading('Users & Permissions', 'perm-title', true)}
	<hx-p class="ex-lead">User profiles, and the API, page and data access each one declares.</hx-p>
	{@render gaps()}
	{#each profiles as profile (profile.source)}
		<Card as="article">
			<hx-h2>{@render link(at(profile.id), profile.title)}</hx-h2>
			<hx-p class="ex-soft">{profile.description}</hx-p>
		</Card>
	{:else}
		<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty"
			>{none} at this revision.</EmptyState
		>
		<hx-p class="ex-note">
			Declare one with <hx-code>harness module generate permissions profile Member</hx-code>
		</hx-p>
	{/each}
{/snippet}

{#snippet detail(profile: ProfileEntry)}
	{@render heading(profile.title, 'perm-title', true)}
	<hx-p class="ex-lead">{profile.description}</hx-p>
	<hx-p class="ex-note">Declared in <hx-code>{profile.source}</hx-code></hx-p>
	{@render gaps()}
	<Card as="section" labelledby="perm-apis">
		<hx-h2 id="perm-apis">API access</hx-h2>
		{#each grants(profile, 'api') as grant, position (position)}
			<hx-article class="ex-stack">
				<hx-h3>{@render ref(grant.resource)}</hx-h3>
				{@render access(grant, `${grant.resource} data access`)}
			</hx-article>
		{:else}
			<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty"
				>No API access declared.</EmptyState
			>
		{/each}
	</Card>
	<Card as="section" labelledby="perm-pages">
		<hx-h2 id="perm-pages">Page access</hx-h2>
		{#each grants(profile, 'page') as grant, position (position)}
			<hx-p>{@render ref(grant.resource)} · {grant.actions.join(', ')}</hx-p>
		{:else}
			<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty"
				>No page access declared.</EmptyState
			>
		{/each}
	</Card>
	<Card as="section" labelledby="perm-data">
		<hx-h2 id="perm-data">Data access</hx-h2>
		{@render data(grants(profile, 'data'), `${profile.title} data access`)}
	</Card>
{/snippet}

{#if host.endpoint !== undefined}
	{@render panel()}
{:else}
	<!-- Profiles are read from the selected revision, whether or not it has a unit registry. -->
	<ExplorerFrame {host} registryRequired={false}>
		{#snippet children()}
			<hx-section
				class="ex-index"
				aria-labelledby="perm-title"
				data-harness-component="networking-security-explorer-permissions-screen"
			>
				{#if !host.route.entity}
					{@render index()}
				{:else}
					<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
						<hx-ol>
							<hx-li>{@render link(at(), 'Users & Permissions')}</hx-li>
							<hx-li aria-current="page">{shown?.title ?? 'Not found'}</hx-li>
						</hx-ol>
					</hx-nav>
					{#if shown}
						{@render detail(shown)}
					{:else}
						<hx-h1 id="perm-title">Profile not found</hx-h1>
						<EmptyState as="p" className="ex-empty explorer-permissions-screen-ex-empty">
							{catalog ? `No profile “${host.route.entity}” is declared` : none} at this revision.
						</EmptyState>
					{/if}
				{/if}
			</hx-section>
		{/snippet}
	</ExplorerFrame>
{/if}
