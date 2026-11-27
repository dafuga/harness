// Harness "needs you" notifications only: no caching and no request handling.
const tag = 'harness-needs-you';
const icon = '/icons/harness-192.png';
const fallback = {
	title: 'A decision needs you',
	body: 'Open Harness to see it.',
	needs: 'all'
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** The message is decrypted by the browser. A push must always show something. */
function read(data) {
	try {
		const value = data.json();
		const texts = [value.title, value.body, value.needs];
		if (texts.every((text) => typeof text === 'string')) return value;
	} catch {
		// An unreadable message still tells Daniel to look.
	}
	return fallback;
}

self.addEventListener('push', (event) => {
	const { title, body, needs } = read(event.data);
	// One tag: each repeat replaces the last one, and alerts again.
	const options = { body, tag, renotify: true, requireInteraction: true, icon, data: { needs } };
	event.waitUntil(self.registration.showNotification(title, options));
});

async function openNeeds(needs) {
	const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	const home = windows.find((client) => new URL(client.url).pathname === '/');
	// Only ever this site's own Home, whatever the message said.
	if (!home) return self.clients.openWindow(`/?needs=${encodeURIComponent(needs)}`);
	home.postMessage({ type: 'harness:needs-you', needs });
	return home.focus();
}

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(openNeeds(event.notification.data?.needs ?? 'all'));
});
