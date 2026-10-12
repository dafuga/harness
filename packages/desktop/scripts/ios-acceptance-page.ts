import './ios-acceptance-quiet';
import { createRemoteDebugger } from 'appium-remote-debugger';
import type { RemoteDebugger } from 'appium-remote-debugger';
import { pagePrelude } from './ios-acceptance-prelude';

/** The logger of the package is chosen by now; nothing started from here inherits its mode. */
delete process.env._TESTING;

function pause(milliseconds: number): Promise<void> {
	return new Promise((done) => {
		setTimeout(done, milliseconds);
	});
}

/** An inspector that is already gone has nothing left to answer. */
function silent(): undefined {
	return undefined;
}

/**
 * TEST ONLY. Reads and drives the real web view of the app in the simulator through WebKit's
 * own inspector, with the `appium-remote-debugger` package. It works only on a product that
 * was made inspectable for a check; a normal product does not let it attach. It is automation
 * by a tool: it types into fields and presses buttons of the page, and it cannot press anything
 * the system draws, such as the prompt of a link.
 */
export class SimulatorPage {
	private inspector: RemoteDebugger | null = null;
	constructor(private readonly simulator: { socketPath: string; runtime: string }) {}

	/** The value of one expression in the page, as text. A lost page is found again. */
	async evaluate(expression: string): Promise<string> {
		let failure = '';
		for (let attempt = 0; attempt < 8; attempt++) {
			try {
				const inspector = await this.connected();
				const value = await inspector.execute(`(() => { ${pagePrelude}${expression} })()`, true);
				return typeof value === 'object' && value ? JSON.stringify(value) : String(value ?? '');
			} catch (error) {
				failure = error instanceof Error ? error.message : String(error);
				await this.reset();
				await pause(1500);
			}
		}
		throw new Error(`The page could not be read: ${failure.split('\n')[0].slice(0, 160)}`);
	}

	/** Waits until the expression's value holds the wanted words, and returns the value. */
	async until(expression: string, wanted: string, seconds = 60): Promise<string> {
		const end = Date.now() + seconds * 1000;
		let last = '';
		while (Date.now() < end) {
			last = await this.evaluate(expression).catch((error: Error) => `error: ${error.message}`);
			if (last.includes(wanted)) return last;
			await pause(1000);
		}
		const seen = last.replace(/\s+/g, ' ').slice(0, 160);
		throw new Error(`"${wanted}" did not appear within ${seconds} s; last seen: ${seen}`);
	}

	/** The app was started again or ended: the connection to its old page is given up. */
	async reset(): Promise<void> {
		const old = this.inspector;
		this.inspector = null;
		await old?.disconnect().catch(silent);
	}

	private async connected(): Promise<RemoteDebugger> {
		if (this.inspector) return this.inspector;
		const inspector = createRemoteDebugger(
			{
				bundleId: 'process-App',
				additionalBundleIds: ['com.dafuga.harness'],
				isSafari: false,
				platformVersion: this.simulator.runtime,
				socketPath: this.simulator.socketPath,
				pageLoadMs: 3000,
				garbageCollectOnExecute: false
			},
			false
		);
		await inspector.connect(8000);
		const pages = await inspector.selectApp(null, 20, true);
		if (!pages.length) throw new Error('No inspectable page of the app was found.');
		const [app, page] = String(pages[0].id).split('.');
		await inspector.selectPage(app, Number(page), true);
		this.inspector = inspector;
		return inspector;
	}
}
