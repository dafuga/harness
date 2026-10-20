<script lang="ts">
	import ActivityList from '../../../../src/components/ActivityList.svelte';
	let { state = 'collapsed' }: { state?: string } = $props();
	const titles: Record<string, string> = {
		collapsed: 'Collapsed list',
		expanded: 'Expanded list',
		short: 'Short list',
		empty: 'Empty list',
		ordered: 'Ordered list',
		error: 'Caller-supplied error row'
	};
	const names = [
		'Review component states',
		'Capture screenshots',
		'Check keyboard navigation',
		'Compare contract examples',
		'Read the change history',
		'Verify responsive layout',
		'Save the results'
	];
	const counts: Record<string, number> = { empty: 0, short: 2, error: 1 };
	const items = $derived(
		names.slice(0, counts[state] ?? 7).map((name) => ({ name, error: state === 'error' }))
	);
</script>

<main class="hx-main state-fixture">
	<p class="eyebrow">Activity List · Supported state</p>
	<h1>{titles[state] ?? state}</h1>
	<section class="pa-card" aria-label="Component preview">
		<h2>Recent activity</h2>
		{#if state === 'empty'}<p class="pa-empty" role="status">No recent activity.</p>{/if}
		<ActivityList
			{items}
			label="Recent activity"
			noun="activities"
			preview={3}
			ordered={state === 'ordered'}
		>
			{#snippet row(item)}
				{#if item.error}
					<div role="alert" class="error-row">
						<strong>Could not read recent activity.</strong>
						<span
							>The caller supplied this error message. Try again when the connection returns.</span
						>
					</div>
				{:else}<div class="activity-row">
						<span aria-hidden="true">✓</span><strong>{item.name}</strong>
					</div>{/if}
			{/snippet}
		</ActivityList>
	</section>
	<p class="note">
		{state === 'error'
			? 'Activity List renders the caller’s row content; it does not fetch data or create errors.'
			: 'Rendered from the real Activity List component with synthetic activity.'}
	</p>
</main>

<style>
	.state-fixture {
		max-width: 760px;
		margin: 0 auto;
		padding: 28px 24px;
	}
	.eyebrow {
		color: var(--hx-gold);
		font-size: 0.8rem;
		margin: 0 0 8px;
	}
	h1 {
		font-size: 1.8rem;
		margin: 0 0 24px;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 1.1rem;
	}
	.activity-row {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 7px 0;
	}
	.activity-row span {
		color: var(--green, #32d5a0);
	}
	.error-row {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-left: 3px solid #ff646b;
		background: #442630;
	}
	.error-row strong {
		color: #ffb9bd;
	}
	.note {
		color: var(--hx-muted);
		line-height: 1.5;
		font-size: 0.85rem;
	}
</style>
