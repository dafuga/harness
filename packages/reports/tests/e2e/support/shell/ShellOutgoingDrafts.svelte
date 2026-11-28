<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../src/components/shared-primitives/atoms -->
<script lang="ts">
	import type {
		HomeOutgoingFields,
		HomeOutgoingVersion
	} from '../../../../src/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';
	import HubHomeCosChat from '../../../../src/components/projects-sessions/hub-home/HubHomeCosChat.svelte';

	const scenario = new URLSearchParams(location.search).get('state') ?? 'idle';
	const status = scenario === 'sent' || scenario === 'discarded' ? scenario : 'draft';
	const delivery =
		scenario === 'sending' || scenario === 'failed' || scenario === 'unconfirmed'
			? scenario
			: 'idle';
	const message = {
		channel: 'gmail' as const,
		account: 'studio@example.test',
		to: ['procurement-north-america-west-coast@example.test'],
		cc: ['accounts@example.test'],
		subject: 'Friday production notes',
		thread: {
			id: 'fixture-thread',
			label: 'November production schedule',
			url: scenario === 'unsafe' ? 'javascript:void(0)' : 'https://example.test/thread'
		},
		body: 'Hi Morgan,\n\nThe revised schedule is ready for Friday. Could you confirm the delivery window before noon?'
	};
	let row = $state({
		id: 'fixture-draft',
		revision: 8,
		status,
		delivery,
		message,
		reason: scenario === 'failed' ? 'The mail provider was unavailable.' : undefined,
		receipt:
			scenario === 'sent'
				? { reference: 'fixture-receipt', url: 'https://example.test/receipt' }
				: null
	});
	const log: unknown[] = [];
	Object.assign(window, { outgoingFixtureCalls: log });

	function discard(version: HomeOutgoingVersion) {
		log.push({ action: 'discard', ...version });
		row.status = 'discarded';
	}
	function send(version: HomeOutgoingVersion) {
		log.push({ action: 'send', ...version });
		if (scenario === 'lost-response') throw new Error('The fixture response was lost.');
		if (scenario !== 'awaiting') row.delivery = 'sending';
	}
	function edit(version: HomeOutgoingVersion, changes: HomeOutgoingFields) {
		log.push({ action: 'edit', ...version, changes });
		row.message = { ...row.message, ...changes, subject: changes.subject ?? '' };
		row.revision++;
	}
	const fixture = $derived({ outgoing: { drafts: [row], discard, send, edit } });
</script>

<hx-div class="home-scheme">
	<hx-main class="home-page hh-home po-page">
		<HubHomeCosChat
			now="2026-11-27T12:00:00Z"
			send={async () => ({ status: 'refused', reason: 'Synthetic fixture' })}
			{...fixture}
		/>
	</hx-main>
</hx-div>
