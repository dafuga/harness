<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type { TranslationRow } from '../../../../../src/core/explorer-ui/Translation.types';
	import type { CatalogFilter } from '../../utils/explorer-ui/entityCatalog';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerControls from './ExplorerControls.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import Select from '../shared-primitives/Select.svelte';
	import '../../lib/styles/translations.css';
	let host: ExplorerScreenProps = $props();
	let filter = $state<CatalogFilter>({
		search: '',
		changedOnly: false,
		order: 'name',
		verification: 'all',
		usage: 'all',
		groups: []
	});
	let limit = $state(50);
	let catalog = $derived(host.head.translations);
	let query = $derived(filter.search.trim().toLocaleLowerCase());
	let language = $state('fr');
	let locales = $derived(
		[...new Set(catalog?.locales ?? ['fr'])].filter((locale) => locale !== 'en')
	);
	let selected = $derived(
		locales.includes(language) ? language : locales.includes('fr') ? 'fr' : (locales[0] ?? 'fr')
	);
	let rows = $derived((catalog?.rows ?? []).filter(matches));
	let visible = $derived(rows.slice(0, limit));
	$effect(() => {
		void query;
		void host.scope.commit;
		limit = 50;
	});
	function matches(row: TranslationRow) {
		return [row.key, row.scope, ...Object.values(row.values)].some((text) =>
			text.toLocaleLowerCase().includes(query)
		);
	}
	function languageName(locale: string) {
		try {
			return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? locale;
		} catch {
			return locale;
		}
	}
</script>

<ExplorerFrame {host} registryRequired={false}>
	{#snippet children(nav)}
		<section
			class="ex-translations"
			data-harness-component="explorer-translations-screen"
			aria-labelledby="translations-title"
		>
			<nav class="ex-crumbs" aria-label="Breadcrumb">
				<ol>
					<li><HarnessIcon name="web" size={18} /></li>
					<li>Translations</li>
				</ol>
			</nav>
			<h1 id="translations-title">Translations</h1>
			<p class="ex-lead">Compare English with a selected language.</p>
			<div class="ex-translations-controls">
				<ExplorerControls noun="translations" bind:filter />
				{#if locales.length}
					<label class="ex-translations-language"
						>Language
						<Select label="Language" bind:value={() => selected, (locale) => (language = locale)}>
							{#each locales as locale}<option value={locale}>{languageName(locale)}</option>{/each}
						</Select>
					</label>
				{/if}
			</div>
			{#if !catalog}
				<p class="ex-empty">No translation catalog is recorded at this revision.</p>
			{:else}
				<p class="ex-note" role="status">{rows.length} of {catalog.rows.length} strings</p>
				{#if catalog.gaps.length}
					<details class="ex-translations-gaps">
						<summary>Some translation sources could not be read</summary>
						<ul>
							{#each catalog.gaps as gap}<li>{gap}</li>{/each}
						</ul>
					</details>
				{/if}
				{#if rows.length}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable table must be keyboard reachable.) -->
					<div
						class="ex-translations-scroll"
						tabindex="0"
						role="region"
						aria-label="Translation strings"
					>
						<table>
							<thead
								><tr
									><th scope="col">English</th><th scope="col">{languageName(selected)}</th><th
										scope="col">Used In</th
									></tr
								></thead
							>
							<tbody>
								{#each visible as row (`${row.scope}:${row.key}`)}
									<tr>
										{#each ['en', selected] as locale}
											<td lang={locale}
												>{#if Object.hasOwn(row.values, locale)}{#if row.values[locale] === ''}<span
															class="ex-translations-missing">Empty string</span
														>{:else}{row.values[locale]}{/if}{:else}<span
														class="ex-translations-missing">Not translated</span
													>{/if}</td
											>
										{/each}
										<td
											class="ex-translations-usage"
											class:ex-translations-unused={!row.usedBy.length}
											><ul class="ex-translations-callers">
												{#each row.usedBy as id}{@const entity = host.entities.find(
														(item) => item.id === id
													)}{#if entity}{@const to = {
															...host.route,
															screen: undefined,
															category: entity.category,
															entity: id
														}}
														<li>
															<a
																href={nav.href(to)}
																onclick={(event) => {
																	if (
																		!event.metaKey &&
																		!event.ctrlKey &&
																		!event.shiftKey &&
																		!event.altKey
																	) {
																		event.preventDefault();
																		nav.go(to);
																	}
																}}>{entity.name}</a
															>
														</li>{/if}{/each}
											</ul>
											{#if !row.usedBy.length}<span class="ex-translations-missing">—</span
												>{/if}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if rows.length > visible.length}<button
							type="button"
							class="ex-button ex-translations-more"
							onclick={() => (limit += 50)}>View More</button
						>{/if}
				{:else}<p class="ex-empty">No translations match this search.</p>{/if}
			{/if}
		</section>
	{/snippet}
</ExplorerFrame>
