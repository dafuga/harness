<script lang="ts">
	import type { Evidence } from '../../../models/reports-media/Report.types';
	import type { CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import {
		entityLens,
		shortCommit,
		type EntityLens,
		type EntityNav
	} from '../../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../../ExplorerUsage.svelte';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		row,
		shot,
		mediaBase,
		nav,
		lens,
		category = 'pages'
	}: {
		row: CatalogRow;
		/** The entity's own screenshot at the shown revision, or null for its gap; never another's. */
		shot: Evidence | null;
		mediaBase: string;
		nav: EntityNav;
		lens: EntityLens;
		/** A page or a component card: its name, its own screenshot and where it is used. */
		category?: 'pages' | 'components';
		/** Still accepted, never shown: every card keeps verification on the entity detail page. */
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
	let provenance = $derived(pictured && shot ? `${shot.title} · ${origin}` : undefined);
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
		<EntityLink {to} {nav} class="ex-page-open" label={`Open ${row.name}`} title={provenance}>
			<h2>{row.name}</h2>
			<span class="ex-thumb">{@render picture()}</span>
		</EntityLink>
		<!-- Beside the page's link, never inside it: a link holds no other link. -->
		<ExplorerUsage consumers={row.usedIn ?? []} {nav} {lens} {mediaBase} />
	{:else}
		<!-- Its name, its own screenshot and where it is used; the rest stays on its detail page. -->
		<figure class="ex-card-shot">
			<EntityLink {to} {nav} class="ex-thumb" label={`Open ${row.name}`}>
				{@render picture()}
			</EntityLink>
		</figure>
		<div class="ex-page-body">
			<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
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
</style>
