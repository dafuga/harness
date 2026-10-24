<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
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
		<hx-section
			class="ex-translations"
			data-harness-component="explorer-translations-screen"
			aria-labelledby="translations-title"
		>
			<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
				<hx-ol>
					<hx-li><HarnessIcon name="web" size={18} /></hx-li>
					<hx-li>Translations</hx-li>
				</hx-ol>
			</hx-nav>
			<hx-h1 id="translations-title">Translations</hx-h1>
			<hx-p class="ex-lead">Compare English with a selected language.</hx-p>
			<hx-div class="ex-translations-controls">
				<ExplorerControls noun="translations" bind:filter />
				{#if locales.length}
					<hx-label class="ex-translations-language"
						>Language
						<Select label="Language" bind:value={() => selected, (locale) => (language = locale)}>
							{#each locales as locale}<hx-option value={locale}>{languageName(locale)}</hx-option
								>{/each}
						</Select>
					</hx-label>
				{/if}
			</hx-div>
			{#if !catalog}
				<hx-p class="ex-empty">No translation catalog is recorded at this revision.</hx-p>
			{:else}
				<hx-p class="ex-note" role="status">{rows.length} of {catalog.rows.length} strings</hx-p>
				{#if catalog.gaps.length}
					<hx-details class="ex-translations-gaps">
						<hx-summary>Some translation sources could not be read</hx-summary>
						<hx-ul>
							{#each catalog.gaps as gap}<hx-li>{gap}</hx-li>{/each}
						</hx-ul>
					</hx-details>
				{/if}
				{#if rows.length}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable table must be keyboard reachable.) -->
					<hx-div
						class="ex-translations-scroll"
						tabindex="0"
						role="region"
						aria-label="Translation strings"
					>
						<hx-table>
							<hx-thead
								><hx-tr
									><hx-th scope="col">English</hx-th><hx-th scope="col"
										>{languageName(selected)}</hx-th
									><hx-th scope="col">Used In</hx-th></hx-tr
								></hx-thead
							>
							<hx-tbody>
								{#each visible as row (`${row.scope}:${row.key}`)}
									<hx-tr>
										{#each ['en', selected] as locale}
											<hx-td lang={locale}
												>{#if Object.hasOwn(row.values, locale)}{#if row.values[locale] === ''}<hx-span
															class="ex-translations-missing">Empty string</hx-span
														>{:else}{row.values[locale]}{/if}{:else}<hx-span
														class="ex-translations-missing">Not translated</hx-span
													>{/if}</hx-td
											>
										{/each}
										<hx-td
											class="ex-translations-usage"
											class:ex-translations-unused={!row.usedBy.length}
											><hx-ul class="ex-translations-callers">
												{#each row.usedBy as id}{@const entity = host.entities.find(
														(item) => item.id === id
													)}{#if entity}{@const to = {
															...host.route,
															screen: undefined,
															category: entity.category,
															entity: id
														}}
														<hx-li>
															<hx-a
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
																}}>{entity.name}</hx-a
															>
														</hx-li>{/if}{/each}
											</hx-ul>
											{#if !row.usedBy.length}<hx-span class="ex-translations-missing">—</hx-span
												>{/if}</hx-td
										>
									</hx-tr>
								{/each}
							</hx-tbody>
						</hx-table>
					</hx-div>
					{#if rows.length > visible.length}<hx-button
							type="button"
							class="ex-button ex-translations-more"
							onclick={() => (limit += 50)}>View More</hx-button
						>{/if}
				{:else}<hx-p class="ex-empty">No translations match this search.</hx-p>{/if}
			{/if}
		</hx-section>
	{/snippet}
</ExplorerFrame>
