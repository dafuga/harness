<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_l66rhhlnz4 -->
<script lang="ts">
	import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { quotaPills } from './hubQuotaPills';
	let { subscriptions, now }: { subscriptions: HomeSubscription[]; now: number } = $props();
	const pills = $derived(quotaPills(subscriptions, now));
	let explained = $state<string | null>(null);
	const meaning = $derived(pills.find((pill) => pill.id === explained)?.meaning);
</script>

<hx-div class="hh-q-pills">
	<hx-ul class="hh-q-pill-list" aria-label="Subscription quota">
		{#each pills as pill (pill.id)}
			{@const level = pill.level === 'out' ? 'critical' : (pill.level ?? undefined)}
			<hx-li>
				<hx-button
					type="button"
					class="po-machine hh-q-headflag hh-q-pill"
					data-level={level}
					title={pill.meaning}
					aria-expanded={explained === pill.id}
					onclick={() => (explained = explained === pill.id ? null : pill.id)}
				>
					{#if pill.word}<hx-span class="hh-q-flag" data-level={level}
							><hx-span class="hh-q-mark" aria-hidden="true"></hx-span>{pill.word}</hx-span
						>{/if}
					<hx-span>{pill.text}</hx-span>
				</hx-button>
			</hx-li>
		{/each}
	</hx-ul>
	{#if meaning}<hx-p class="hh-q-meaning" role="status">{meaning}</hx-p>{/if}
</hx-div>
