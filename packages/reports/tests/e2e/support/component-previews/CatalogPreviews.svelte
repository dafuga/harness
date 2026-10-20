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
	const explorer = unit.source.includes('/components/harness/');
	setContext(key, fixture.hub);
	setContext(remoteContext, fixture.remote);
	onDestroy(fixture.cleanup);
</script>

<div class="hx-shell preview-catalog" class:hub-page={id.startsWith('hub.')}>
	<main class="hx-main" class:full-frame={fullFrame}>
		<h1 id="preview-title">{unit.title}</h1>
		{#await fixture.ready}<p role="status">Preparing component preview…</p>{:then}
			<div
				class="preview-content"
				class:provider-picker={id.includes('provider-picker')}
				class:account={id === 'hub.component.account-menu'}
				class:ex-content={explorer}
				data-preview-unit={unit.id}
			>
				<Component {...fixture.props} />
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
	.full-frame {
		padding: 0 0 64px;
	}
	.full-frame h1 {
		padding: 20px var(--hx-gutter) 0;
	}
	.preview-content {
		min-width: 0;
	}
	.preview-content :global(img) {
		max-width: 100%;
	}
</style>
