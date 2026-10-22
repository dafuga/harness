<script lang="ts">
	import type { Evidence } from '../../../models/reports-media/Report.types';
	import { listed, type CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import { entityLens, shortCommit, type EntityLens, type EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../../ExplorerUsage.svelte';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		row,
		shot,
		mediaBase,
		nav,
		lens,
		category = 'pages',
		verification = true
	}: {
		row: CatalogRow;
		/** The entity's own screenshot at the shown revision, or null for its gap; never another's. */
		shot: Evidence | null;
		mediaBase: string;
		nav: EntityNav;
		lens: EntityLens;
		/** A page counts its components; a component tells where it is used and what it contains. */
		category?: 'pages' | 'components';
		/** Relationship cards keep verification on the entity detail page. */
		verification?: boolean;
	} = $props();
	let to = $derived(entityLens(nav.route, { category, entity: row.id }));
	let file = $derived(shot && !shot.missing ? shot.file : '');
	// A failure belongs to one file: the file of another revision is tried afresh.
	let failed = $state('');
	$effect(() => {
		if (file) failed = '';
	});
	let pictured = $derived(Boolean(file) && failed !== file);
	// Only a capture the record calls fresh was taken at this revision; any other was reused.
	let taken = $derived(shot?.standing === 'Fresh capture' ? 'Captured at' : 'Reused from');
	let origin = $derived(`${taken} ${shortCommit(shot?.source ?? '')}`);
	let page = $derived(category === 'pages');
	let open = $derived(page ? 'Open page' : 'Open component');
</script>

{#snippet picture()}
	{#if pictured && shot}
		<img
			src={mediaBase + file}
			alt={`Screenshot of ${row.name}`}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = file)}
		/>
	{:else}
		<span class="ex-thumb-gap">
			<HarnessIcon name={categoryIcon[category]} size={28} />
			<span>No screenshot is recorded at this revision</span>
		</span>
	{/if}
{/snippet}

<article class="ex-page-card" class:ex-page-minimal={page} aria-label={row.name}>
	{#if page}
		<EntityLink
			{to}
			{nav}
			class="ex-page-open"
			label={`Open ${row.name}`}
			title={pictured && shot ? `${shot.title} · ${origin}` : undefined}
		>
			<h2>{row.name}</h2>
			<span class="ex-thumb">{@render picture()}</span>
		</EntityLink>
		<!-- Beside the page's link, never inside it: a link holds no other link. -->
		<ExplorerUsage consumers={row.usedIn ?? []} {nav} {lens} {mediaBase} />
	{:else}
		<figure class="ex-card-shot">
			<EntityLink {to} {nav} class="ex-thumb" label={`Open ${row.name}`}>
				{@render picture()}
			</EntityLink>
			{#if pictured && shot}
				<figcaption title={shot.note}>
					<span>In context · {shot.title}</span><span>{origin}</span>
				</figcaption>
			{/if}
		</figure>
		<div class="ex-page-body">
			<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
			<p class="ex-soft">{row.summary}</p>
			<p class="ex-fact">
				<HarnessIcon name="layers" size={22} />
				<span><strong>Contains</strong> {listed(row.contains, 2)}</span>
				{#if row.shared}<span class="ex-pill gold">Shared</span>{/if}
				{#if row.changed}<span class="ex-pill gold">Changed</span>{/if}
			</p>
			{#if verification}<p class="ex-fact">
					<HarnessIcon name="tests" size={22} />
					<HarnessVerdict {...row.verdict} framed />
				</p>{/if}
			<EntityLink {to} {nav} class="hx-action gold ex-open-page" label={open} title={open}>
				<HarnessIcon name="arrow-right" size={18} />
			</EntityLink>
			<ExplorerUsage consumers={row.usedIn ?? []} {nav} {lens} {mediaBase} />
		</div>
	{/if}
</article>

<style>
	.ex-page-card.ex-page-minimal {
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
	}
	:global(.ex-page-open) {
		display: grid;
		gap: 14px;
		min-width: 0;
	}
	:global(.ex-page-open h2) {
		font-size: 1.2rem;
		overflow-wrap: anywhere;
	}
	:global(.ex-page-open:focus-visible) {
		outline: 2px solid var(--ex-gold);
		outline-offset: 6px;
	}

	.ex-page-body > :global(.ex-open-page) {
		justify-self: end;
		width: 36px;
		height: 36px;
		min-height: 36px;
		padding: 8px;
	}
</style>
