<script lang="ts">
	import { behaviorDuration, entityBehavior } from '../../../reports/src/utils/entityBehavior';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../models/DesktopEvidence.types';
	import RuntimeRun from './RuntimeRun.svelte';
	let { result, evidence }: { result: EntityEvidenceResult; evidence: EntityEvidence } = $props();
	const short = (commit: string) => commit.slice(0, 7);
	const behavior = $derived(result.behavior);
	/** Undefined while the results are being read; null when reading them failed. */
	const known = $derived(evidence.read);
	const reading = $derived(known === undefined && behavior.rows.length > 0);
	/** What the results come to is concluded by the reports explorer, before and after reading. */
	const shown = $derived(entityBehavior(known ?? behavior));
	/** A first commit is one run: it has no parent to stand beside. */
	const paired = $derived(shown.mode === 'commit' && result.scope.parent !== null);
	const at = $derived(short(result.scope.commit));
	/** One run, or unknown for a stated reason, stands without reading anything. */
	const fixed = $derived(
		behavior.summary === 'not-compared' ||
			(behavior.summary === 'unknown' && behavior.reason !== null)
	);
	/** Bytes that differ are no change yet: nothing else is said before both were read. */
	const pending = $derived(reading && !fixed);
	const label = $derived.by(() => {
		if (pending) return 'Reading the recorded results…';
		return known === null ? 'Behavior unknown' : shown.label;
	});
	const why = $derived(
		known === null ? 'The recorded results could not be read.' : shown.reasons.join('; ')
	);
	const duration = $derived(
		behaviorDuration(
			result.evidence.after.record,
			shown.scenarios.map((item) => item.id)
		)
	);
</script>

<div class="runtime-card">
	<h3>{paired ? 'End-to-end comparison' : 'Current end-to-end behavior'}</h3>
	<p class="muted">
		{paired
			? 'The same scenario and the same states at the parent and at the commit.'
			: `What the end-to-end checks recorded at ${at}.`}
	</p>
	<p class="runtime-verdict">
		<strong role="status">{label}</strong>{#if why}<span>{why}</span>{/if}
	</p>
	{#if shown.groups.length === 0}<p class="empty">
			No end-to-end result is recorded for this entity at {at}.
		</p>{:else}<div class="runtime-panes" class:paired>
			{#if paired}<RuntimeRun
					{shown}
					side="before"
					title={`Before · ${short(result.scope.parent ?? '')}`}
					role="Parent commit"
					lost={known === null}
					refusals={evidence.refusals}
				/>{/if}<RuntimeRun
				{shown}
				side="after"
				title={paired ? `After · ${at}` : `Current snapshot · ${at}`}
				role={paired ? 'Selected commit' : 'Branch tip'}
				lost={known === null}
				refusals={evidence.refusals}
			/>
		</div>{/if}
	<dl class="runtime-facts">
		<dt>End-to-end duration</dt>
		<dd>{duration ?? 'Not measured'}</dd>
		{#each shown.scenarios as scenario (scenario.id)}<dt>{scenario.title}</dt>
			<dd>
				{paired ? `${scenario.before ?? 'not run'} → ` : ''}{scenario.after ?? 'not run'}
			</dd>{/each}
	</dl>
</div>
