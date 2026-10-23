<script lang="ts">
	import type { PlatformEntry } from '../../../../../src/core/explorer-ui/Platform.types';
	import {
		platformViews,
		platformStatus,
		unrecorded
	} from '../../utils/explorer-ui/explorer-platforms/platformStatus';
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/explorer-ui/shortCommit';
	import '../../lib/styles/platforms.css';
	import EntityLink from './EntityLink.svelte';
	import EntityMissing from './EntityMissing.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import SourceFileList from './SourceFileList.svelte';
	let { host, nav }: { host: ExplorerScreenProps; nav: EntityNav } = $props();
	type Row = { name: string; value: string; description?: string };
	let list = $derived<ExplorerLocation>({
		branch: host.route.branch,
		commit: host.route.commit,
		category: 'platforms'
	});
	let view = $derived(platformViews.find((item) => item.id === host.route.entity));
	let catalog = $derived(host.head.platforms);
	// Only this revision's own declaration: no other revision lends a platform its settings.
	let entry = $derived(catalog?.entries.find((item) => item.id === view?.id));
	let status = $derived(platformStatus(entry));
	// A gap other than a plain absence says why the manifest could not be read.
	let gap = $derived(catalog?.gap && catalog.gap !== unrecorded ? catalog.gap : undefined);
	let commands = $derived<Row[]>(
		(entry?.commands ?? []).map(({ name, command }) => ({ name, value: command }))
	);
	const github = /^https:\/\/github\.com\/[A-Za-z0-9_-]+\/(?!\.\.?$)[A-Za-z0-9_.-]+$/;
	const fullHash = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
	/** The file at exactly the shown commit, or nothing: a path is never linked elsewhere. */
	function sourceLink(path: string): string | undefined {
		const repository = host.index.sourceRepository;
		const commit = host.scope.commit;
		if (!repository || !github.test(repository) || !fullHash.test(commit)) return;
		const parts = path.split('/');
		if (path.includes('\\') || parts.some((part) => !part || part === '.' || part === '..')) return;
		return `${repository}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
	}
</script>

{#snippet table(label: string, column: string, rows: Row[])}
	<div class="ex-scroll">
		<table class="ex-mini pf-table" aria-label={label}>
			<thead><tr><th scope="col">Name</th><th scope="col">{column}</th></tr></thead>
			<tbody>
				{#each rows as row, position (position)}
					<tr>
						<th scope="row">
							<span>{row.name}</span>
							{#if row.description}<span class="pf-description">{row.description}</span>{/if}
						</th>
						<td><code>{row.value}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet sections(declared: PlatformEntry, name: string)}
	<div class="pf-sections">
		<section class="ex-card" aria-labelledby="pf-configuration-title">
			<h2 id="pf-configuration-title">Deployment configuration</h2>
			{#if declared.configuration.length}
				{@render table(`${name} deployment configuration`, 'Value', declared.configuration)}
			{:else}<p class="ex-soft">No deployment settings are declared for {name}.</p>{/if}
		</section>
		{#if commands.length}
			<section class="ex-card" aria-labelledby="pf-commands-title">
				<h2 id="pf-commands-title">Commands</h2>
				{@render table(`${name} commands`, 'Command', commands)}
			</section>
		{/if}
		{#if declared.requirements.length}
			<section class="ex-card" aria-labelledby="pf-requirements-title">
				<h2 id="pf-requirements-title">Release requirements</h2>
				<ul class="ex-reasons pf-requirements">
					{#each declared.requirements as requirement, position (position)}
						<li>{requirement}</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if declared.sources.length}
			<section class="ex-card" aria-labelledby="pf-sources-title">
				<h2 id="pf-sources-title">Configuration sources</h2>
				<SourceFileList files={declared.sources} href={sourceLink}>
					{#snippet children()}{/snippet}
				</SourceFileList>
				{#if !declared.sources.some((path) => sourceLink(path))}
					<p class="ex-note">GitHub links are unavailable here, so paths are shown as recorded.</p>
				{/if}
			</section>
		{/if}
	</div>
{/snippet}

<nav class="ex-crumbs" aria-label="Breadcrumb">
	<ol>
		<li><EntityLink to={list} {nav}>Platforms</EntityLink></li>
		<li aria-current="page">{view?.name ?? 'Not found'}</li>
	</ol>
</nav>
{#if !view}
	<EntityMissing
		title="Platform not found"
		message={`No platform is called “${host.route.entity}”; choose Web, iOS, Android or Desktop.`}
		{nav}
		to={list}
		action="All platforms"
	/>
{:else}
	<header class="ex-head">
		<span class="ex-tile"><HarnessIcon name={view.icon} size={30} /></span>
		<div class="ex-head-main">
			<div class="ex-head-title">
				<h1>{view.name}</h1>
				<span class="pf-status" data-status={status.id}>{status.label}</span>
			</div>
			<p class="ex-lead">{entry?.summary ?? unrecorded}</p>
			{#if entry}
				<dl class="pf-meta">
					<div>
						<dt>Runtime</dt>
						<dd>{entry.runtime}</dd>
					</div>
					<div>
						<dt>Declared at</dt>
						<dd><code>{shortCommit(host.scope.commit)}</code></dd>
					</div>
				</dl>
				<p class="ex-note">
					A status is what the repository declares; Harness does not check live deployments.
				</p>
			{:else}
				<p class="ex-note">Nothing from another revision is shown in its place.</p>
			{/if}
		</div>
	</header>
	{#if entry}
		{@render sections(entry, view.name)}
	{:else if gap}
		<p class="pf-notice"><HarnessIcon name="info" size={18} /><span>{gap}</span></p>
	{/if}
{/if}
