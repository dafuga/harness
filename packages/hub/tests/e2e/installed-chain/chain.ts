import { startChainCloud } from './chainCloud';
import { startChainMac } from './chainMac';
import { startChainTracker } from './chainTracker';

async function online(origin: string): Promise<boolean> {
	const reply = await fetch(`${origin}/api/remote/hosts?linked=1`, {
		headers: { 'x-test-session': 'session-browser' }
	});
	const body = (await reply.json()) as { computers?: { online: boolean }[] };
	return Boolean(body.computers?.some((computer) => computer.online));
}

async function linked(origin: string, output: () => string) {
	const deadline = Date.now() + 30_000;
	while (!(await online(origin))) {
		if (Date.now() > deadline)
			throw new Error(`The installed Mac never linked to the Hub.\n${output()}`);
		await new Promise((done) => setTimeout(done, 200));
	}
}

/** Tracker, installed Mac, relay and Hub, joined as production joins them. */
export async function startInstalledChain() {
	const [tracker, cloud] = await Promise.all([startChainTracker(), startChainCloud()]);
	const mac = await startChainMac(cloud.origin, tracker.origin);
	const stop = async () => {
		await mac.stop();
		await cloud.stop();
		tracker.stop();
	};
	await linked(cloud.origin, mac.output).catch(async (error) => {
		await stop();
		throw error;
	});
	return { tracker, cloud, mac, stop };
}
