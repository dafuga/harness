<script lang="ts">
	import DataTable from '../../../../src/components/shared-primitives/DataTable.svelte';
	import CodeLine from '../../../../src/components/shared-primitives/CodeLine.svelte';
	import DetailList from '../../../../src/components/shared-primitives/DetailList.svelte';
	import HarnessAction from '../../../../src/components/explorer-ui/HarnessAction.svelte';
	import EmptyState from '../../../../src/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import Modal from '../../../../src/components/shared-primitives/Modal.svelte';
	let { id, variant }: { id: string; variant: string } = $props();
	let inspection = $state(false);
	const longName = 'OrderStore.findByCustomerAndRevision'.repeat(8);
	const sources: Record<string, string> = {
		long: `const source = '${longName}';`,
		multiline: 'const order = {\n  active: false,\n  attempts: 0\n};',
		wrap: 'const order = {\n  active: false,\n  attempts: 0\n};'
	};
	let source = $derived(sources[variant] ?? 'src/components/OrderCard.svelte');
	const factStates: Record<string, Array<{ key: string; label: string; value: unknown }>> = {
		empty: [],
		'empty-unprovided': [],
		values: [
			{ key: 'absent', label: 'Absent', value: undefined },
			{ key: 'disabled', label: 'Disabled', value: false },
			{ key: 'attempts', label: 'Attempts', value: 0 },
			{ key: 'blank', label: 'Blank', value: '' }
		],
		long: [{ key: 'long', label: longName, value: longName }],
		'duplicate-labels': [
			{ key: 'first', label: 'Source', value: 'Checkout capture' },
			{ key: 'second', label: 'Source', value: 'Release review' }
		]
	};
	let facts = $derived(
		factStates[variant] ?? [
			{ key: 'first', label: 'Source', value: 'Checkout capture' },
			{ key: 'second', label: 'Revision', value: '7c4a8d09e1b2' }
		]
	);
	function shown(value: unknown) {
		if (value === undefined) return 'Not recorded';
		if (value === '') return 'Empty string';
		return String(value);
	}
</script>

{#snippet emptyRows()}<tr><td colspan="2">No fields recorded.</td></tr>{/snippet}
{#snippet emptyDetails()}<EmptyState>No details provided.</EmptyState>{/snippet}
<div class="ex-content presentation-preview">
	{#if id.endsWith('data-table')}
		<DataTable
			label="Contract fields"
			tableClass="ex-table"
			isEmpty={['empty', 'empty-unprovided'].includes(variant)}
			empty={variant === 'empty-unprovided' ? undefined : emptyRows}
		>
			{#snippet header()}<tr><th scope="col">Name</th><th scope="col">Type</th></tr>{/snippet}

			{#snippet children()}
				<tr><th scope="row">{variant === 'long' ? longName : 'active'}</th><td>boolean</td></tr>
				<tr><th scope="row">attempts</th><td>number</td></tr>
			{/snippet}
		</DataTable>
	{:else if id.endsWith('code-line')}
		{#if ['action-focused', 'inspection-open'].includes(variant)}
			<CodeLine text={source}>
				{#snippet action()}
					<HarnessAction
						label="Inspect full source"
						tone="plain"
						onclick={() => (inspection = true)}>Inspect</HarnessAction
					>
				{/snippet}
			</CodeLine>
		{:else}<CodeLine text={source} mode={variant === 'wrap' ? 'wrap' : 'clip'} />{/if}
		<Modal
			open={inspection}
			title="Full source"
			variant="text"
			onClose={() => (inspection = false)}
		>
			<CodeLine text={source} mode="wrap" />
		</Modal>
	{:else}
		<DetailList
			rows={facts}
			rowKey={(fact) => fact.key}
			empty={variant === 'empty-unprovided' ? undefined : emptyDetails}
		>
			{#snippet label(fact)}{fact.label}{/snippet}
			{#snippet children(fact)}{shown(fact.value)}{/snippet}
		</DetailList>
	{/if}
</div>
