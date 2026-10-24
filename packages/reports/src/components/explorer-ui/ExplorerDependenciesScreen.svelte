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
			.map(([id, title]) => ({ id, title, rows: listed.filter((row) => row.entry.ecosystem === id) }))
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
		const words = [name, version, kind, ...row.used.flatMap((use) => [use.workspace, ...use.sources])];
		return words.some((word) => word.toLowerCase().includes(query));
	}
</script>

<!-- A gap is a manifest that could not be read; the declarations that could be still show. -->
{#snippet gapNotice(gaps: string[])}
	<div class="dep-gaps" role="note">
		<HarnessIcon name="info" size={18} />
		<div>
			<p>Some manifests could not be read, so these declarations may be incomplete.</p>
			<ul>{#each gaps as gap, position (position)}<li>{gap}</li>{/each}</ul>
		</div>
	</div>
{/snippet}

<!-- The version is the requirement as written in the manifest, never a resolved install. -->
{#snippet inventory(table: (typeof tables)[number])}
	<div class="dep-group">
		<h2>
			{table.title}<span class="ex-pill"
				>{table.rows.length}<span class="ex-hidden"> declarations</span></span
			>
		</h2>
		<div class="ex-scroll dep-scroll">
			<table class="ex-table dep-table" aria-label={`${table.title} dependencies`}>
				<thead>
					<tr>
						<th scope="col">Package</th>
						<th scope="col">Version</th>
						<th scope="col">Type</th>
						<th scope="col">Used in</th>
					</tr>
				</thead>
				<tbody>
					{#each table.rows as row (row.key)}
						<tr>
							<th scope="row"><code class="dep-name">{row.entry.name}</code></th>
							<td data-label="Version"
								>{#if row.entry.version}<code>{row.entry.version}</code>{:else}<span
										class="ex-soft">Not declared</span
									>{/if}</td
							>
							<td data-label="Type">{kinds[row.entry.kind]}</td>
							<td data-label="Used in">
								<ul class="dep-uses">
									{#each row.used as use (use.workspace)}
										<li title={use.sources.join(', ')}>{use.workspace}</li>
									{/each}
								</ul>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/snippet}

{#snippet declared(found: ProjectDependencies)}
	{#if found.gaps.length}{@render gapNotice(found.gaps)}{/if}
	{#if rows.length}
		<ExplorerControls noun="dependencies" bind:filter />
		<p class="ex-hidden" role="status">{listed.length} of {rows.length} declarations shown</p>
		{#each tables as table (table.id)}{@render inventory(table)}{/each}
		{#if !listed.length}
			<p class="ex-empty">
				No dependencies match this search.
				<button type="button" class="ex-text-button" onclick={() => (filter.search = '')}
					>Clear search</button
				>
			</p>
		{/if}
	{:else}
		<p class="ex-empty">
			{found.gaps.length
				? 'No declarations could be read from the manifests at this revision.'
				: 'No dependencies are declared in the manifests at this revision.'}
		</p>
	{/if}
{/snippet}

<!-- Declarations are read from the selected revision, whether or not it has a unit registry. -->
<ExplorerFrame {host} registryRequired={false}>
	{#snippet children()}
		<section
			class="ex-index"
			aria-labelledby="dep-title"
			data-harness-component="explorer-dependencies-screen"
		>
			<h1 id="dep-title">Dependencies</h1>
			<p class="ex-lead">Direct package declarations at this revision.</p>
			<p class="ex-soft">
				Versions are the requirements each manifest declares.
			</p>
			{#if record}
				{@render declared(record)}
			{:else}
				<p class="ex-empty">
					No dependency record was indexed for this revision. It may predate dependency indexing.
				</p>
			{/if}
		</section>
	{/snippet}
</ExplorerFrame>

<style>
	.dep-group {
		display: grid;
		gap: var(--hx-space-10);
		min-width: 0;
	}
	/* A long name wraps; whatever still cannot fit scrolls here, never the document. */
	.dep-scroll {
		overflow-x: auto;
	}
	.dep-table {
		width: 100%;
	}
	.dep-table thead th:first-child {
		width: 36%;
	}
	.dep-table code {
		white-space: nowrap;
	}
	.dep-name {
		font-weight: var(--hx-style-weight-medium);
	}
	.dep-uses {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--hx-space-6);
		overflow-wrap: anywhere;
	}
	.dep-uses li,
	.dep-gaps li {
		margin: 0;
		line-height: var(--hx-style-leading-normal);
	}
	.dep-uses li:not(:last-child)::after {
		content: ',';
	}
	.dep-gaps {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--hx-space-10);
		padding: var(--hx-space-12) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--ex-line-strong);
		border-radius: var(--hx-radius-small);
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
	}
	.dep-gaps ul {
		display: grid;
		gap: var(--hx-space-4);
		margin-top: var(--hx-space-6);
		color: var(--ex-muted);
		overflow-wrap: anywhere;
	}
</style>
