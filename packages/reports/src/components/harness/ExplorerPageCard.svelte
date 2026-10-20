<script lang="ts">
	import type { Evidence } from '../../models/Report.types';
	import { type CatalogRow } from '../../utils/entityCatalog';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import { categoryIcon } from '../../utils/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		row,
		shot,
		mediaBase,
		nav,
		category = 'pages'
	}: {
		row: CatalogRow;
		/** The entity's own screenshot at the shown revision, or null for its gap; never another's. */
		shot: Evidence | null;
		mediaBase: string;
		nav: EntityNav;
		/** Pages show their title and screenshot; components also link to their consumers. */
		category?: 'pages' | 'components';
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
	{:else}
		<EntityLink
			{to}
			{nav}
			class="ex-thumb"
			label={`Open ${row.name}`}
			title={pictured && shot ? `${shot.title} · ${origin}` : undefined}
		>
			{@render picture()}
		</EntityLink>
		<div class="ex-page-body">
			<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
			<div class="ex-component-usage" role="group" aria-label="Used In">
				<span>Used In</span>
				{#each row.usedIn ?? [] as consumer (consumer.id)}
					<EntityLink
						to={entityLens(nav.route, { category: consumer.category, entity: consumer.id })}
						{nav}>{consumer.name}</EntityLink
					>{' '}
				{:else}<span>—</span>{/each}
			</div>
		</div>
	{/if}
</article>

<style>
	.ex-page-card.ex-page-minimal {
		grid-template-columns: minmax(0, 1fr);
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

	.ex-component-usage {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		align-items: baseline;
		font-size: 0.8rem;
		color: var(--hx-muted, #92a6bb);
	}
</style>
