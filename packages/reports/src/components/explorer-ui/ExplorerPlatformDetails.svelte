<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Row } from './ExplorerPlatformDetails.types';

	import type { PlatformEntry } from '../../../../../src/core/explorer-ui/Platform.types';
	import {
		platformViews,
		platformStatus,
		unrecorded
	} from '../../utils/explorer-ui/explorer-platforms/platformStatus';
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import '../../lib/styles/platforms.css';
	import EntityLink from './EntityLink.svelte';
	import EntityMissing from './EntityMissing.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import SourceFileList from './SourceFileList.svelte';
	let { host, nav }: { host: ExplorerScreenProps; nav: EntityNav } = $props();
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
	<hx-div class="ex-scroll">
		<hx-table class="ex-mini pf-table" aria-label={label}>
			<hx-thead
				><hx-tr><hx-th scope="col">Name</hx-th><hx-th scope="col">{column}</hx-th></hx-tr></hx-thead
			>
			<hx-tbody>
				{#each rows as row, position (position)}
					<hx-tr>
						<hx-th scope="row">
							<hx-span>{row.name}</hx-span>
							{#if row.description}<hx-span class="pf-description">{row.description}</hx-span>{/if}
						</hx-th>
						<hx-td><hx-code>{row.value}</hx-code></hx-td>
					</hx-tr>
				{/each}
			</hx-tbody>
		</hx-table>
	</hx-div>
{/snippet}

{#snippet sections(declared: PlatformEntry, name: string)}
	<hx-div class="pf-sections">
		<hx-section class="ex-card" aria-labelledby="pf-configuration-title">
			<hx-h2 id="pf-configuration-title">Deployment configuration</hx-h2>
			{#if declared.configuration.length}
				{@render table(`${name} deployment configuration`, 'Value', declared.configuration)}
			{:else}<hx-p class="ex-soft">No deployment settings are declared for {name}.</hx-p>{/if}
		</hx-section>
		{#if commands.length}
			<hx-section class="ex-card" aria-labelledby="pf-commands-title">
				<hx-h2 id="pf-commands-title">Commands</hx-h2>
				{@render table(`${name} commands`, 'Command', commands)}
			</hx-section>
		{/if}
		{#if declared.requirements.length}
			<hx-section class="ex-card" aria-labelledby="pf-requirements-title">
				<hx-h2 id="pf-requirements-title">Release requirements</hx-h2>
				<hx-ul class="ex-reasons pf-requirements">
					{#each declared.requirements as requirement, position (position)}
						<hx-li>{requirement}</hx-li>
					{/each}
				</hx-ul>
			</hx-section>
		{/if}
		{#if declared.sources.length}
			<hx-section class="ex-card" aria-labelledby="pf-sources-title">
				<hx-h2 id="pf-sources-title">Configuration sources</hx-h2>
				<SourceFileList files={declared.sources} href={sourceLink}>
					{#snippet children()}{/snippet}
				</SourceFileList>
				{#if !declared.sources.some((path) => sourceLink(path))}
					<hx-p class="ex-note"
						>GitHub links are unavailable here, so paths are shown as recorded.</hx-p
					>
				{/if}
			</hx-section>
		{/if}
	</hx-div>
{/snippet}

<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
	<hx-ol>
		<hx-li><EntityLink to={list} {nav}>Platforms</EntityLink></hx-li>
		<hx-li aria-current="page">{view?.name ?? 'Not found'}</hx-li>
	</hx-ol>
</hx-nav>
{#if !view}
	<EntityMissing
		title="Platform not found"
		message={`No platform is called “${host.route.entity}”; choose Web, iOS, Android or Desktop.`}
		{nav}
		to={list}
		action="All platforms"
	/>
{:else}
	<hx-header class="ex-head">
		<hx-span class="ex-tile"><HarnessIcon name={view.icon} size={30} /></hx-span>
		<hx-div class="ex-head-main">
			<hx-div class="ex-head-title">
				<hx-h1>{view.name}</hx-h1>
				<hx-span class="pf-status" data-status={status.id}>{status.label}</hx-span>
			</hx-div>
			<hx-p class="ex-lead">{entry?.summary ?? unrecorded}</hx-p>
			{#if entry}
				<hx-dl class="pf-meta">
					<hx-div>
						<hx-dt>Runtime</hx-dt>
						<hx-dd>{entry.runtime}</hx-dd>
					</hx-div>
					<hx-div>
						<hx-dt>Declared at</hx-dt>
						<hx-dd><hx-code>{shortCommit(host.scope.commit)}</hx-code></hx-dd>
					</hx-div>
				</hx-dl>
				<hx-p class="ex-note">
					A status is what the repository declares; Harness does not check live deployments.
				</hx-p>
			{:else}
				<hx-p class="ex-note">Nothing from another revision is shown in its place.</hx-p>
			{/if}
		</hx-div>
	</hx-header>
	{#if entry}
		{@render sections(entry, view.name)}
	{:else if gap}
		<hx-p class="pf-notice"><HarnessIcon name="info" size={18} /><hx-span>{gap}</hx-span></hx-p>
	{/if}
{/if}
