// @harness-uid u_haukajqwwx
import { CanaryBrowserError } from './CanaryBrowserError';
import { cdpConnection } from './cdpConnection';
import { pressOptionScript, rowLabelsScript, signedInScript } from './hubRowScripts';
import type { CanaryWeb } from './canary.types';

const settleMs = 5000;
const settle = () => new Promise((resolve) => setTimeout(resolve, settleMs));

/**
 * The canary's own tab in the shared automation Chrome. It opens one tab and closes that tab only;
 * it reads no cookie or storage and never closes the browser.
 */
export async function automationChromeTab(browser: string, hub: string): Promise<CanaryWeb> {
	const opened = await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' });
	if (!opened.ok) throw new CanaryBrowserError(`the browser refused a new tab (${opened.status})`);
	const tab = (await opened.json()) as { id: string; webSocketDebuggerUrl: string };
	const closeTab = async () => void (await fetch(`${browser}/json/close/${tab.id}`));
	try {
		const connection = await cdpConnection(tab.webSocketDebuggerUrl);
		await connection.send('Page.navigate', { url: `${hub}/` });
		await settle();
		return hubPage(connection, hub, closeTab);
	} catch (error) {
		await closeTab();
		throw error;
	}
}

function hubPage(
	connection: Awaited<ReturnType<typeof cdpConnection>>,
	hub: string,
	closeTab: () => Promise<void>
): CanaryWeb {
	async function evaluate<Value>(expression: string): Promise<Value> {
		const guarded = `location.origin === ${JSON.stringify(hub)} ? (${expression}) : Promise.reject('not on the Hub')`;
		const reply = await connection.send('Runtime.evaluate', {
			expression: guarded,
			awaitPromise: true,
			returnByValue: true
		});
		if (reply.exceptionDetails) throw new CanaryBrowserError('the Hub page could not be read');
		return (reply.result as { value: Value }).value;
	}
	return {
		signedIn: () => evaluate<boolean>(signedInScript),
		row: (marker) => evaluate<string[] | null>(rowLabelsScript(marker)),
		press: (marker, label) => evaluate<boolean>(pressOptionScript(marker, label)),
		async reload() {
			await connection.send('Page.reload');
			await settle();
		},
		async close() {
			connection.close();
			await closeTab();
		}
	};
}
