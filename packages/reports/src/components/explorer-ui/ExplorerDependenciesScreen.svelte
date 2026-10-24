<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		ProjectDependencies,
		ProjectDependency
	} from '../../../../../src/services/explorer-ui/revision-detail-service/projectDependencies.types';
	import type { CatalogFilter } from '../../utils/explorer-ui/entityCatalog';
	import '../../lib/styles/gallery.css';
	import ExplorerControls from './ExplorerControls.svelte';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let host: ExplorerScreenProps = $props();
	const kinds: Record<ProjectDependency['kind'], string> = {
		runtime: 'Runtime',
		development: 'Development',
		peer: 'Peer',
		optional: 'Optional',
		build: 'Build'
	};
	const ecosystems: Record<ProjectDependency['ecosystem'], string> = { npm: 'npm', cargo: 'Cargo' };
	const rank = (kind: ProjectDependency['kind']) => Object.keys(kinds).indexOf(kind);
	let filter = $state<CatalogFilter>({ search: '', changedOnly: false, order: 'name' });
	// Absent on a revision indexed before manifests were read; never filled from the working copy.
	let record = $derived(host.head.projectDependencies);
	let rows = $derived(group(record?.entries ?? []));
	let query = $derived(filter.search.trim().toLowerCase());
	let listed = $derived(query ? rows.filter((row) => matches(row, query)) : rows);
	let tables = $derived(
		Object.entries(ecosystems)
			.map(([id, title]) => ({
				id,
				title,
				rows: listed.filter((row) => row.entry.ecosystem === id)
			}))
			.filter((table) => table.rows.length)
	);
	/** One row per ecosystem, name, version and kind, naming once each workspace that declares it. */
	function group(entries: ProjectDependency[]) {
		const grouped: {
			key: string;
			entry: ProjectDependency;
			used: { workspace: string; sources: string[] }[];
		}[] = [];
		const sorted = [...entries].sort(
			(a, b) =>
				a.name.localeCompare(b.name) ||
				a.version.localeCompare(b.version, undefined, { numeric: true }) ||
				rank(a.kind) - rank(b.kind)
		);
		for (const entry of sorted) {
			const key = JSON.stringify([entry.ecosystem, entry.name, entry.version, entry.kind]);
			let row = grouped.find((item) => item.key === key);
			if (!row) grouped.push((row = { key, entry, used: [] }));
			const workspace = entry.workspace || entry.source;
			let use = row.used.find((item) => item.workspace === workspace);
			if (!use) row.used.push((use = { workspace, sources: [] }));
			const where = entry.condition ? `${entry.source} (${entry.condition})` : entry.source;
			if (!use.sources.includes(where)) use.sources.push(where);
		}
		for (const row of grouped) row.used.sort((a, b) => a.workspace.localeCompare(b.workspace));
		return grouped;
	}
	function matches(row: ReturnType<typeof group>[number], query: string): boolean {
		const { name, version, kind } = row.entry;
		const words = [
			name,
			version,
			kind,
			...row.used.flatMap((use) => [use.workspace, ...use.sources])
		];
		return words.some((word) => word.toLowerCase().includes(query));
	}
</script>

<!-- A gap is a manifest that could not be read; the declarations that could be still show. -->
{#snippet gapNotice(gaps: string[])}
	<hx-div class="dep-gaps" role="note">
		<HarnessIcon name="info" size={18} />
		<hx-div>
			<hx-p>Some manifests could not be read, so these declarations may be incomplete.</hx-p>
			<hx-ul
				>{#each gaps as gap, position (position)}<hx-li>{gap}</hx-li>{/each}</hx-ul
			>
		</hx-div>
	</hx-div>
{/snippet}

<!-- The version is the requirement as written in the manifest, never a resolved install. -->
{#snippet inventory(table: (typeof tables)[number])}
	<hx-div class="dep-group">
		<hx-h2>
			{table.title}<hx-span class="ex-pill"
				>{table.rows.length}<hx-span class="ex-hidden"> declarations</hx-span></hx-span
			>
		</hx-h2>
		<hx-div class="ex-scroll dep-scroll">
			<hx-table class="ex-table dep-table" aria-label={`${table.title} dependencies`}>
				<hx-thead>
					<hx-tr>
						<hx-th scope="col">Package</hx-th>
						<hx-th scope="col">Version</hx-th>
						<hx-th scope="col">Type</hx-th>
						<hx-th scope="col">Used in</hx-th>
					</hx-tr>
				</hx-thead>
				<hx-tbody>
					{#each table.rows as row (row.key)}
						<hx-tr>
							<hx-th scope="row"><hx-code class="dep-name">{row.entry.name}</hx-code></hx-th>
							<hx-td data-label="Version"
								>{#if row.entry.version}<hx-code>{row.entry.version}</hx-code>{:else}<hx-span
										class="ex-soft">Not declared</hx-span
									>{/if}</hx-td
							>
							<hx-td data-label="Type">{kinds[row.entry.kind]}</hx-td>
							<hx-td data-label="Used in">
								<hx-ul class="dep-uses">
									{#each row.used as use (use.workspace)}
										<hx-li title={use.sources.join(', ')}>{use.workspace}</hx-li>
									{/each}
								</hx-ul>
							</hx-td>
						</hx-tr>
					{/each}
				</hx-tbody>
			</hx-table>
		</hx-div>
	</hx-div>
{/snippet}

{#snippet declared(found: ProjectDependencies)}
	{#if found.gaps.length}{@render gapNotice(found.gaps)}{/if}
	{#if rows.length}
		<ExplorerControls noun="dependencies" bind:filter />
		<hx-p class="ex-hidden" role="status">{listed.length} of {rows.length} declarations shown</hx-p>
		{#each tables as table (table.id)}{@render inventory(table)}{/each}
		{#if !listed.length}
			<hx-p class="ex-empty">
				No dependencies match this search.
				<hx-button type="button" class="ex-text-button" onclick={() => (filter.search = '')}
					>Clear search</hx-button
				>
			</hx-p>
		{/if}
	{:else}
		<hx-p class="ex-empty">
			{found.gaps.length
				? 'No declarations could be read from the manifests at this revision.'
				: 'No dependencies are declared in the manifests at this revision.'}
		</hx-p>
	{/if}
{/snippet}

<!-- Declarations are read from the selected revision, whether or not it has a unit registry. -->
<ExplorerFrame {host} registryRequired={false}>
	{#snippet children()}
		<hx-section
			class="ex-index"
			aria-labelledby="dep-title"
			data-harness-component="explorer-dependencies-screen"
		>
			<hx-h1 id="dep-title">Dependencies</hx-h1>
			<hx-p class="ex-lead">Direct package declarations at this revision.</hx-p>
			<hx-p class="ex-soft"> Versions are the requirements each manifest declares. </hx-p>
			{#if record}
				{@render declared(record)}
			{:else}
				<hx-p class="ex-empty">
					No dependency record was indexed for this revision. It may predate dependency indexing.
				</hx-p>
			{/if}
		</hx-section>
	{/snippet}
</ExplorerFrame>

<style>
	@import './explorer-dependencies-screen/explorerDependenciesScreen.css';
</style>
