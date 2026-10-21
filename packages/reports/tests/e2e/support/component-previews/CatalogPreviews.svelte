<script lang="ts">
	import { setContext, onDestroy, untrack } from 'svelte';
	import { key } from '../../../../../hub/src/utils/browserContext';
	import { remoteContext } from '../../../../../desktop/src/models/Environment.types';
	import { previewUnits, previewComponent } from './units';
	import { previewFixture } from './fixtures.svelte';
	let { id: requested }: { id: string } = $props();
	const id = untrack(() => requested);
	const unit = previewUnits.find((unit) => unit.id === id);
	if (!unit) throw new Error(`Unknown preview component ${id}`);
	const fixture = previewFixture(id);
	const Component = previewComponent(unit.source);
	const fullFrame = /harness-(navbar|header|console|shell)$/.test(id);
	const explorer =
		unit.source.includes('/components/harness/') ||
		['explorer-catalog-items', 'explorer-usage', 'explorer-usage-link'].some(
			(name) => id === `reports.component.${name}`
		);
	const reports = id.startsWith('reports.');
	const historyColumns = [
		'Date',
		'Commit',
		'Behavior change',
		'Attempts',
		'Size',
		'Complexity',
		'Timing',
		'Verdict',
		'Revision'
	];
	setContext(key, fixture.hub);
	setContext(remoteContext, fixture.remote);
	onDestroy(fixture.cleanup);
</script>

<div class="preview-catalog" class:hx-shell={reports} class:hub-page={id.startsWith('hub.')}>
	<main class="preview-main" class:hx-main={reports} class:full-frame={fullFrame}>
		<h1 id="preview-title">{unit.title}</h1>
		{#await fixture.ready}<p role="status">Preparing component preview…</p>{:then}
			<div
				class="preview-content"
				class:provider-picker={id.includes('provider-picker')}
				class:account={id === 'hub.component.account-menu'}
				class:ex-content={explorer}
				data-preview-unit={unit.id}
			>
				{#if id === 'reports.component.harness-entity-history-row'}
					<div class="ex-scroll">
						<table class="ex-table ex-history" aria-label="History row preview">
							<thead
								><tr
									>{#each historyColumns as column (column)}<th>{column}</th>{/each}</tr
								></thead
							>
							<tbody><Component {...fixture.props} /></tbody>
						</table>
					</div>
				{:else}
					<Component {...fixture.props} />
				{/if}
			</div>
		{/await}
	</main>
</div>

<style>
	h1 {
		overflow-wrap: anywhere;
	}
	.preview-catalog {
		min-height: 100vh;
	}
	.preview-main:not(.hx-main) {
		min-width: 0;
		padding: 20px;
	}
	.preview-main.full-frame {
		padding: 0 0 64px;
	}
	.full-frame h1 {
		padding: 20px var(--hx-gutter, 20px) 0;
	}
	.preview-content {
		min-width: 0;
	}
	.preview-content :global(img) {
		max-width: 100%;
	}
</style>
