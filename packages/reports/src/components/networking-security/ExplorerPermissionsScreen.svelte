<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import { plainClick } from '../../utils/explorer-ui/harnessShell';
	import ExplorerFrame from '../explorer-ui/ExplorerFrame.svelte';
	import type {
		ApiGrant,
		DataGrant,
		ExplorerPermissionsScreenProps,
		ProfileEntry,
		ProfileGrant
	} from './ExplorerPermissionsScreen.types';
	let host: ExplorerPermissionsScreenProps = $props();
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
		type Kind = Extract<ProfileGrant, { kind: K }>;
		return profile.grants.filter((grant): grant is Kind => grant.kind === kind);
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
	// A modified click, or another button, stays the browser's so a new tab can open it.
	function follow(event: MouseEvent, to: ExplorerLocation) {
		if (!plainClick(event)) return;
		event.preventDefault();
		host.onroute(to);
	}
</script>

{#snippet link(to: ExplorerLocation, text: string, code = false)}
	<hx-a href={host.lens.href(to)} onclick={(event) => follow(event, to)}
		>{#if code}<hx-code>{text}</hx-code>{:else}{text}{/if}</hx-a
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
		<hx-span class="ex-pill">Declared policy</hx-span>
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
		<hx-div class="ex-scroll" tabindex="0" role="region" aria-label={label}>
			<hx-table class="ex-table">
				<hx-thead>
					<hx-tr>
						<hx-th scope="col">Model</hx-th>
						<hx-th scope="col">Actions</hx-th>
						<hx-th scope="col">Fields</hx-th>
						<hx-th scope="col">Scope</hx-th>
					</hx-tr>
				</hx-thead>
				<hx-tbody>
					{#each rows as row, position (position)}
						<hx-tr>
							<hx-th scope="row">{@render ref(row.resource)}</hx-th>
							<hx-td>{row.actions.join(', ')}</hx-td>
							<hx-td><hx-code>{row.fields.join(', ')}</hx-code></hx-td>
							<hx-td>{row.scope}</hx-td>
						</hx-tr>
					{/each}
				</hx-tbody>
			</hx-table>
		</hx-div>
	{:else}
		<hx-p class="ex-empty">No data access declared.</hx-p>
	{/if}
{/snippet}

{#snippet access(grant: ApiGrant, label: string)}
	<hx-ul class="ex-links inline" aria-label="HTTP methods">
		{#each grant.actions as method, place (place)}<hx-li class="ex-pill">{method}</hx-li>{/each}
	</hx-ul>
	{@render data(grant.data, label)}
{/snippet}

<!-- Drawn inside the endpoint's own frame, so it opens no frame of its own. -->
{#snippet panel()}
	<hx-section
		class="ex-card"
		aria-labelledby="perm-api"
		data-harness-component="networking-security-explorer-permissions-screen"
	>
		{@render heading('Permissions', 'perm-api', false)}
		{@render gaps()}
		{#each declared as { profile, grant }, position (position)}
			<hx-article class="ex-stack">
				<hx-h3>{@render link(at(profile.id), profile.title)}</hx-h3>
				{@render access(grant, `${profile.title} data access`)}
			</hx-article>
		{:else}
			<hx-p class="ex-empty">No access declaration names this endpoint at this revision.</hx-p>
		{/each}
	</hx-section>
{/snippet}

{#snippet index()}
	{@render heading('Users & Permissions', 'perm-title', true)}
	<hx-p class="ex-lead">User profiles, and the API, page and data access each one declares.</hx-p>
	{@render gaps()}
	{#each profiles as profile (profile.source)}
		<hx-article class="ex-card">
			<hx-h2>{@render link(at(profile.id), profile.title)}</hx-h2>
			<hx-p class="ex-soft">{profile.description}</hx-p>
		</hx-article>
	{:else}
		<hx-p class="ex-empty">{none} at this revision.</hx-p>
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
	<hx-section class="ex-card" aria-labelledby="perm-apis">
		<hx-h2 id="perm-apis">API access</hx-h2>
		{#each grants(profile, 'api') as grant, position (position)}
			<hx-article class="ex-stack">
				<hx-h3>{@render ref(grant.resource)}</hx-h3>
				{@render access(grant, `${grant.resource} data access`)}
			</hx-article>
		{:else}
			<hx-p class="ex-empty">No API access declared.</hx-p>
		{/each}
	</hx-section>
	<hx-section class="ex-card" aria-labelledby="perm-pages">
		<hx-h2 id="perm-pages">Page access</hx-h2>
		{#each grants(profile, 'page') as grant, position (position)}
			<hx-p>{@render ref(grant.resource)} · {grant.actions.join(', ')}</hx-p>
		{:else}
			<hx-p class="ex-empty">No page access declared.</hx-p>
		{/each}
	</hx-section>
	<hx-section class="ex-card" aria-labelledby="perm-data">
		<hx-h2 id="perm-data">Data access</hx-h2>
		{@render data(grants(profile, 'data'), `${profile.title} data access`)}
	</hx-section>
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
						<hx-p class="ex-empty">
							{catalog ? `No profile “${host.route.entity}” is declared` : none} at this revision.
						</hx-p>
					{/if}
				{/if}
			</hx-section>
		{/snippet}
	</ExplorerFrame>
{/if}
