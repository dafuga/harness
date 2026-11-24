<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_zj35fp7e6k -->
<script lang="ts">
	import type { InboxRow } from '../../../models/development-tooling/TrackerInbox.types';
	import { bucketLabels } from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	let {
		rows,
		selected,
		empty,
		label,
		onselect
	}: {
		rows: InboxRow[];
		selected: string | null;
		empty: string;
		label: string;
		onselect: (id: string) => void;
	} = $props();
</script>

<hx-ul class="rows" aria-label={label}>
	{#each rows as row (row.header.id)}
		<hx-li>
			<hx-button
				type="button"
				class="row"
				data-bucket={row.bucket}
				aria-current={selected === row.header.id ? 'true' : undefined}
				onclick={() => onselect(row.header.id)}
			>
				<hx-span class="tag tag-{row.bucket}">{bucketLabels[row.bucket]}</hx-span>
				<hx-span class="title">{row.header.title}</hx-span>
				<hx-span class="meta">{row.header.project} · {row.header.id}</hx-span>
			</hx-button>
		</hx-li>
	{:else}
		<hx-li><hx-p class="hint">{empty}</hx-p></hx-li>
	{/each}
</hx-ul>

<style>
	:global(.rows) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--hx-space-6);
	}
	:global(.rows button.row) {
		display: grid;
		gap: var(--hx-space-4);
		width: 100%;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		border-radius: var(--hx-radius-small);
		padding: var(--hx-space-8) var(--hx-space-10);
		font: inherit;
		text-align: left;
	}
	:global(.rows [aria-current='true']) {
		border-color: var(--hx-color-primary);
	}
	:global(.rows .title) {
		font-weight: var(--hx-style-weight-semibold);
	}
	:global(.rows .meta),
	:global(.rows .hint) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		margin: 0;
	}
	:global(.rows .tag) {
		font-size: var(--hx-type-size-2xs);
		color: var(--hx-color-primary);
	}
</style>
