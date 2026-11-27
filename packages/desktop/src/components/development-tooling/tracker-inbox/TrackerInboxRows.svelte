<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_zj35fp7e6k -->
<script lang="ts">
	import type {
		InboxRow,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import {
		bucketLabels,
		trackerStageLabels
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	import { slide } from 'svelte/transition';
	import { MediaQuery } from 'svelte/reactivity';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';

	import {
		optionWrite,
		writtenAnswer
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import { sendRowAnswer } from '../../../lib/development-tooling/tracker-inbox/sendRowAnswer';
	import type {
		ConfirmedWrite,
		InboxDetail
	} from '../../../models/development-tooling/TrackerInbox.types';
	import TrackerInboxChoices from './TrackerInboxChoices.svelte';

	let {
		source,
		mode,
		onchanged,
		onnotice,
		rows,
		selected,
		empty,
		label,
		onselect
	}: {
		source: TrackerInboxSource;
		mode: 'phone' | 'mac';
		onchanged: () => Promise<void>;
		/** Told what a row's answer did. The list shows it: an answered row leaves the list. */
		onnotice: (message: string) => void;
		rows: InboxRow[];
		selected: string | null;
		empty: string;
		label: string;
		onselect: (id: string) => void;
	} = $props();
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	let active = $state<{ row: InboxRow; index: number; text: string; accepted: boolean } | null>(
		null
	);
	const busy = $derived(Boolean(active));
	/** The revisions answered here, so a queued answer cannot be tapped twice. */
	let answered = $state<string[]>([]);
	const key = (review: InboxDetail) => `${review.header.id} ${review.revision}`;
	const reviewed = (review: InboxDetail) => ({
		itemId: review.header.id,
		revision: review.revision
	});

	const shown = $derived.by(() => {
		const list = rows.filter(
			(row) => label !== 'Needs you' || !row.review || !answered.includes(key(row.review))
		);
		if (active && !list.some((row) => row.header.id === active?.row.header.id))
			list.splice(active.index, 0, active.row);
		return list;
	});

	async function deliver(row: InboxRow, write: ConfirmedWrite | null) {
		if (busy || !row.review) return;
		active = { row, index: rows.indexOf(row), text: write?.text ?? '', accepted: false };
		try {
			const result = await sendRowAnswer(source, write, mode);
			onnotice(result.message);
			if (result.sent) {
				active.accepted = true;
				answered = [...answered, key(row.review)];
				await Promise.all([onchanged(), new Promise((done) => setTimeout(done, 900))]);
			} else await onchanged();
		} catch {
			onnotice('Could not confirm the Tracker update. Check the item before retrying.');
		} finally {
			active = null;
		}
	}
</script>

<hx-ul class="rows" aria-label={label}>
	{#each shown as row (row.header.id)}
		<hx-li out:slide={{ duration: reduceMotion.current ? 0 : 320 }}>
			<hx-button
				type="button"
				class="row"
				data-bucket={row.bucket}
				aria-current={selected === row.header.id ? 'true' : undefined}
				onclick={() => onselect(row.header.id)}
			>
				{#if row.ask}
					<hx-span class="title">{row.header.project}</hx-span>
					<hx-span class="question">{row.ask.question}</hx-span>
					{#if row.ask.since}<hx-span class="meta"
							>waiting {waitAge(row.ask.since, Date.now())}</hx-span
						>{/if}
				{:else}
					<hx-span class="tag tag-{row.bucket}">{bucketLabels[row.bucket]}</hx-span>
					<hx-span class="title">{row.header.title}</hx-span>
					<hx-span class="meta"
						>{row.header.project} · {row.header.id} · {trackerStageLabels[
							row.header.stage ?? 'idea'
						]}</hx-span
					>
				{/if}
			</hx-button>
			{#if active?.row.header.id === row.header.id}
				<hx-p role="status" class="meta"
					>{active.accepted ? (mode === 'phone' ? 'Queued' : 'Answered') : 'Sending'} · {active.text}</hx-p
				>
			{:else if row.review?.flag && !answered.includes(key(row.review))}
				{@const review = row.review}
				<TrackerInboxChoices
					flag={row.review.flag}
					{busy}
					compact
					onpick={(number) => void deliver(row, optionWrite(review, reviewed(review), number))}
					onother={(text) => void deliver(row, writtenAnswer(review, reviewed(review), text))}
				/>
			{/if}
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
		gap: var(--hx-space-16);
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
	:global(.rows li) {
		display: grid;
		gap: var(--hx-space-8);
		min-width: 0;
	}
	:global(.rows .question) {
		overflow-wrap: anywhere;
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
