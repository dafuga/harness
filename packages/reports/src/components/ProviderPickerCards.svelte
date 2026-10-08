<script lang="ts">
	import type { SessionObservation, SwitchRequest } from '../../../../src/core/pickerTypes';
	import type { PickerModel, ProviderSelection } from '../../../../src/core/pickerModelTypes';
	let {
		active,
		request,
		models,
		providers,
		locked,
		oncancel
	}: {
		active: SessionObservation | null;
		request: SwitchRequest | null;
		models: PickerModel[];
		providers: Record<string, string>;
		locked: boolean;
		oncancel: () => void;
	} = $props();
	function labelFor(target: ProviderSelection): string {
		return (
			models.find((item) => item.provider === target.provider && item.model === target.model)
				?.label ?? target.model
		);
	}
	function when(iso: string): string {
		return Date.parse(iso)
			? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
			: iso;
	}
</script>

{#snippet choice(target: ProviderSelection)}
	<strong>{labelFor(target)}</strong>
	<p>{providers[target.provider] ?? target.provider} · {target.model} · {target.effort} effort</p>
{/snippet}

<div class="picker-cards">
	<article class="picker-card picker-active">
		<h3>Active model</h3>
		{#if active}
			{@render choice(active.selection)}
			<p>
				{active.idle ? 'Idle' : 'In use'} · clients: {active.clients} · observed {when(
					active.observedAt
				)}
			</p>
		{:else}
			<strong>Unknown</strong>
			<p>No verified observation of this session yet.</p>
		{/if}
	</article>
	<article class="picker-card picker-request" data-status={request?.status}>
		<h3>
			Requested switch <span class="picker-status"
				>{request ? request.status[0].toUpperCase() + request.status.slice(1) : 'None'}</span
			>
		</h3>
		{#if request}
			{@render choice(request.target)}
			<p>Queued {when(request.createdAt)}{request.reason ? ` · ${request.reason}` : ''}</p>
		{:else}
			<p>Nothing is queued for this session.</p>
		{/if}
		{#if request?.status === 'pending'}
			<button type="button" onclick={oncancel} disabled={locked}>Cancel pending switch</button>
		{/if}
	</article>
</div>
