<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_4f4poxrujm -->
<script lang="ts">
	import '../../../lib/styles/hub-home/outgoing-drafts.css';
	import HarnessIcon from '../../explorer-ui/HarnessIcon.svelte';
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	import DetailList from '../../shared-primitives/DetailList.svelte';
	import LinkifiedText from '../../shared-primitives/LinkifiedText.svelte';
	import { outgoingChannels, outgoingHref } from './hubHomeOutgoingDraft';
	import type {
		HomeOutgoingActions,
		HomeOutgoingDetail,
		HomeOutgoingDraft
	} from './hubHomeOutgoingDraft.types';

	let {
		draft,
		send,
		discard,
		edit
	}: {
		draft: HomeOutgoingDraft;
		send: HomeOutgoingActions['send'];
		discard: HomeOutgoingActions['discard'];
		edit: (draft: HomeOutgoingDraft, trigger: HTMLButtonElement) => void;
	} = $props();

	const title = $props.id();
	const statusLabels = {
		draft: 'Draft',
		sending: 'Sending',
		sent: 'Sent',
		discarded: 'Discarded',
		failed: 'Delivery failed',
		unconfirmed: 'Delivery unconfirmed'
	};
	let sendingRevision = $state<number>();
	let uncertainRevision = $state<number>();
	let pending = $state<'send' | 'discard'>();
	const { message } = $derived(draft);
	const channel = $derived(outgoingChannels[message.channel]);
	const deliveryState = $derived.by(() => {
		if (draft.status !== 'draft') return draft.status;
		if (draft.delivery === 'sending' || draft.delivery === 'unconfirmed') return draft.delivery;
		if (draft.revision === uncertainRevision) return 'unconfirmed';
		if (draft.revision === sendingRevision) return 'sending';
		return draft.delivery === 'idle' ? 'draft' : draft.delivery;
	});
	const editable = $derived(deliveryState === 'draft' || deliveryState === 'failed');
	const thread = $derived(outgoingHref(message.thread?.url));
	const details = $derived(
		[
			{ label: 'In reply to', value: message.thread?.label, href: thread },
			{ label: 'To', value: message.to.join(', ') },
			{ label: 'Cc', value: message.cc.join(', ') }
		].filter((row) => row.value)
	);
	const receipt = $derived(outgoingHref(draft.receipt?.url));
	const bodyParts = $derived(
		message.body
			.split('\n', 4)
			.join('\n')
			.match(/^.{0,200}/su)?.[0] ?? ''
	);
	const longBody = $derived(bodyParts.length < message.body.length);
	let error = $state('');

	async function act(action: 'send' | 'discard') {
		if (!editable || pending || (action === 'send' && draft.canSend === false)) return;
		const { id, revision } = draft;
		pending = action;
		if (action === 'send') sendingRevision = revision;
		error = '';
		try {
			await (action === 'send' ? send : discard)({ id, revision });
		} catch {
			if (action === 'send') uncertainRevision = revision;
			else error = 'Could not discard this draft. Check its latest status before trying again.';
		} finally {
			pending = undefined;
		}
	}
</script>

<hx-article class="outgoing-card" aria-labelledby={title} data-delivery={deliveryState}>
	<hx-header class="outgoing-header">
		<hx-span class="outgoing-icon"><HarnessIcon name={channel.icon} size={18} /></hx-span>
		<hx-div class="outgoing-account">
			<hx-span class="outgoing-channel">{channel.label}</hx-span>
			<hx-span>{message.account}</hx-span>
		</hx-div>
		<Pill tone="hh-tone po-state" state={deliveryState} role="status"
			>{statusLabels[deliveryState]}</Pill
		>
	</hx-header>
	<hx-div class="outgoing-subject">
		<hx-h3 id={title}>{message.subject || `${channel.label} message`}</hx-h3>
		{#if editable}
			<hx-button
				class="po-action outgoing-edit"
				type="button"
				disabled={Boolean(pending)}
				onclick={(event) => edit(draft, event.currentTarget)}>Edit</hx-button
			>
		{/if}
	</hx-div>
	{#if details.length}
		<DetailList
			rows={details}
			rowKey={(row) => row.label}
			className="outgoing-fields"
			grouped={false}
		>
			{#snippet label(row: HomeOutgoingDetail)}{row.label}{/snippet}
			{#snippet children(row: HomeOutgoingDetail)}
				{#if row.href}
					<hx-a href={row.href} target="_blank" rel="noopener noreferrer">{row.value}</hx-a>
				{:else}<LinkifiedText text={row.value ?? ''} />{/if}
			{/snippet}
		</DetailList>
	{/if}
	{#if longBody}
		<hx-details class="outgoing-body">
			<hx-summary>{bodyParts.trimEnd() + '…'}</hx-summary>
			<hx-p><LinkifiedText text={message.body} /></hx-p>
		</hx-details>
	{:else}
		<hx-p class="outgoing-body"><LinkifiedText text={message.body} /></hx-p>
	{/if}
	{#if deliveryState === 'failed' || deliveryState === 'unconfirmed'}
		<hx-p class="outgoing-notice">
			{deliveryState === 'failed'
				? draft.reason || 'The provider did not accept this message.'
				: 'Tracker is checking whether the message was delivered.'}
		</hx-p>
	{/if}
	{#if error}<hx-p class="outgoing-notice" role="alert">{error}</hx-p>{/if}
	{#if editable && draft.canSend === false}
		<hx-p class="outgoing-notice">This sending account is unavailable.</hx-p>
	{/if}
	{#if editable || deliveryState === 'sending'}
		<hx-footer class="outgoing-actions">
			<hx-button
				type="button"
				class="po-action"
				disabled={Boolean(pending) || !editable}
				onclick={() => act('discard')}>{pending === 'discard' ? 'Discarding' : 'Discard'}</hx-button
			>
			<hx-button
				type="button"
				class="po-action outgoing-primary"
				disabled={Boolean(pending) || !editable || draft.canSend === false}
				onclick={() => act('send')}>{deliveryState === 'failed' ? 'Retry send' : 'Send'}</hx-button
			>
		</hx-footer>
	{:else if deliveryState === 'sent' && receipt}
		<hx-a class="outgoing-receipt" href={receipt} target="_blank" rel="noopener noreferrer"
			>View receipt <HarnessIcon name="external" size={15} /></hx-a
		>
	{/if}
</hx-article>
