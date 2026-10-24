<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { RemoteHost } from '../../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemotePairingOffer } from '../../../models/development-tooling/Environment.types';
	import { qrSymbol } from './qrSymbol';
	import { timeLeft } from './remoteLabels';
	let { offer, store }: { offer: RemotePairingOffer; store: RemoteHost } = $props();
	/**
	 * The open offer as a QR code for the phone to scan. The offer is drawn, never written out,
	 * and only while it can still be used: one whose time has passed is not shown.
	 */
	let now = $state(Date.now());
	const left = $derived(Date.parse(offer.expiresAt) - now);
	/** The symbol follows the offer and whether it is still live, not every tick of the clock. */
	const live = $derived(left > 0);
	const symbol = $derived(live ? drawn(offer.scan) : null);
	const side = $derived(symbol ? symbol.size + symbol.quiet * 2 : 0);
	const how = 'Scan this code with Harness on your phone. Then approve the phone here.';
	const expired = 'This code has expired.';
	const unshown = 'This code cannot be shown. Make a new one.';
	function drawn(text: string) {
		try {
			return qrSymbol(text);
		} catch {
			return null;
		}
	}
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
</script>

<hx-div class="remote-offer">
	{#if symbol}<hx-span>{how}</hx-span><hx-svg
			class="remote-qr"
			role="img"
			aria-label="Pairing QR code"
			viewBox="0 0 {side} {side}"
			shape-rendering="crispEdges"
			><hx-svg-rect width={side} height={side} fill="var(--hx-color-text)" /><hx-svg-path
				d={symbol.path}
				fill="var(--hx-color-background)"
			/></hx-svg
		><hx-small class="muted">Expires in {timeLeft(left)}</hx-small>{:else}<hx-span
			class="remote-note">{live ? unshown : expired}</hx-span
		>{/if}
	<hx-div class="remote-actions">
		<hx-button type="button" disabled={store.busy} onclick={() => void store.createPairing()}
			>New code</hx-button
		>{#if symbol}<hx-button
				type="button"
				disabled={store.busy}
				onclick={() => void store.closePairing()}>Hide code</hx-button
			>{/if}
	</hx-div>
</hx-div>
