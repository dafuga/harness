// @harness-uid u_up46ysb3zk
/** What this browser itself knows about push: support, permission and its own subscription. */
const worker = '/push-sw.js';

export function pushSupport(): 'supported' | 'install' | 'unsupported' {
	if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)
		return 'supported';
	// An iPhone or iPad offers push only to a site added to the Home Screen.
	const apple =
		/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
	return apple ? 'install' : 'unsupported';
}

function keyBytes(publicKey: string): Uint8Array<ArrayBuffer> {
	const text = atob(publicKey.replaceAll('-', '+').replaceAll('_', '/'));
	return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function sameKey(subscription: PushSubscription, publicKey: string) {
	const held = subscription.options.applicationServerKey;
	if (!held) return true;
	const wanted = keyBytes(publicKey);
	const bytes = new Uint8Array(held);
	return bytes.length === wanted.length && bytes.every((byte, index) => byte === wanted[index]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	const registration = await navigator.serviceWorker.getRegistration('/');
	return (await registration?.pushManager.getSubscription()) ?? null;
}

/** This browser's subscription for the Hub's current key; a replaced key subscribes again. */
export async function subscribe(publicKey: string): Promise<PushSubscription> {
	await navigator.serviceWorker.register(worker);
	const registration = await navigator.serviceWorker.ready;
	const held = await registration.pushManager.getSubscription();
	if (held && sameKey(held, publicKey)) return held;
	await held?.unsubscribe();
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: keyBytes(publicKey)
	});
}

export async function addressHash(address: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Shows at once that this browser can display notifications; the next real one replaces it. */
export async function confirmOn(): Promise<void> {
	const registration = await navigator.serviceWorker.ready;
	await registration.showNotification('Notifications are on', {
		body: 'Harness tells you here when a decision needs you.',
		tag: 'harness-needs-you',
		icon: '/icons/harness-192.png',
		data: { needs: 'all' }
	});
}

/** The approved inbox may alert a browser that already enabled notifications. */
export async function showApprovalNotice(signal: AbortSignal): Promise<boolean> {
	if (
		signal.aborted ||
		typeof Notification === 'undefined' ||
		Notification.permission !== 'granted'
	)
		return false;
	try {
		const registration = await navigator.serviceWorker?.getRegistration('/');
		if (!registration?.active || signal.aborted) return false;
		await registration.showNotification('Harness', {
			body: 'A device sign-in is ready for review.',
			tag: 'harness-device-approval',
			icon: '/icons/harness-192.png'
		});
		return true;
	} catch {
		// The card is still available when system notifications are unavailable.
		return false;
	}
}
