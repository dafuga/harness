// @harness-uid u_ppvcb4vola
import type { RemoteAccountComputer } from '../../../../remote/src/models/networking-security/RemoteControl.types';
import type {
	HomeChatInput,
	HomeChatReceipt,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { RemoteFailure } from '../../../../remote/src/index';
import { homeChatReceipt, showsHomeChatTarget } from './linkedHomeChat';
import { completeHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import { mergeHomeSnapshots } from '$reports/components/projects-sessions/hub-home/hubHomeMerge';
import { parseLinkedHome } from '../../routes/api/hub-home/homeLivePayload';
import type { BrowserApi } from '../../utils/browserApi';
import { browserDeviceKeys } from '../../utils/networking-security/browserDeviceKeys';
import { BrowserComputerService } from './BrowserComputerService';
import type { Connect, LinkedHome } from './LinkedHomeService.types';

export type { LinkedHome } from './LinkedHomeService.types';

const hosts = '/api/remote/hosts';
const readMs = 15_000;
const writeMs = 20_000;
const parallel = 6;

function within<T>(work: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), ms);
		work.then(resolve, reject).finally(() => clearTimeout(timer));
	});
}

/**
 * Home for a signed-in account: every online computer linked to it is asked for what runs
 * there, over the same end-to-end encrypted device connection as the Devices page, with no
 * click. Each connection is kept for the next read and closed with the page.
 */
export class LinkedHomeService {
	private readonly open = new Map<string, BrowserComputerService>();
	private readonly shown = new Map<string, OwnerHomeSnapshot>();
	private closed = false;

	constructor(
		private readonly api: BrowserApi,
		private readonly actor: string,
		private readonly create: Connect = (hostId) =>
			new BrowserComputerService(this.api, () => browserDeviceKeys(this.actor, hostId))
	) {}

	async read(): Promise<LinkedHome> {
		const listed = await this.computers();
		const computers = listed ?? [];
		const online = computers.filter((computer) => computer.online).slice(0, parallel);
		const results = await Promise.all(online.map((computer) => this.ask(computer.hostId)));
		this.shown.clear();
		for (const [index, snapshot] of results.entries())
			if (snapshot) this.shown.set(online[index].hostId, completeHomeSnapshot(snapshot));
		const snapshots = results.filter((entry): entry is OwnerHomeSnapshot => entry !== null);
		return {
			linked: computers.length,
			answered: snapshots.length,
			snapshot: mergeHomeSnapshots(snapshots.map(completeHomeSnapshot)),
			...(!listed && { unlisted: true as const })
		};
	}

	/**
	 * Hands an answer or note to a computer that showed the item, over its end-to-end encrypted
	 * connection; the Hub never reads or stores it. Null when none offers that, so nothing was
	 * sent. Once a computer may have received it, no other path is tried.
	 */
	async chat(message: HomeChatInput): Promise<HomeChatReceipt | null> {
		for (const [hostId, snapshot] of this.shown) {
			const link = this.open.get(hostId);
			if (!link || !showsHomeChatTarget(snapshot, message)) continue;
			try {
				const reply = await within(link.chat(message), writeMs);
				return homeChatReceipt(message.id, reply as Partial<HomeChatReceipt> | null);
			} catch (cause) {
				if (cause instanceof RemoteFailure && cause.code === 'method-denied') continue;
				this.drop(hostId, link);
				return { id: message.id, status: 'unconfirmed' };
			}
		}
		return null;
	}

	close(): void {
		this.closed = true;
		for (const link of this.open.values()) link.close();
		this.open.clear();
	}

	private async computers(): Promise<RemoteAccountComputer[] | null> {
		try {
			const reply = await this.api.get<{ computers: RemoteAccountComputer[] }>(hosts, {
				linked: '1'
			});
			return reply.computers;
		} catch (error) {
			// Remote access being off is a real "none linked"; any other failure leaves it unknown.
			return (error as { code?: string }).code === 'remote-disabled' ? [] : null;
		}
	}

	private async ask(hostId: string): Promise<OwnerHomeSnapshot | null> {
		if (this.closed) return null;
		const link = this.open.get(hostId) ?? this.create(hostId);
		this.open.set(hostId, link);
		try {
			const value = await within(
				link.home(hostId, () => this.drop(hostId, link)),
				readMs
			);
			return this.closed ? null : (parseLinkedHome(value) as OwnerHomeSnapshot);
		} catch {
			this.drop(hostId, link);
			return null;
		}
	}

	private drop(hostId: string, link: BrowserComputerService): void {
		link.close();
		if (this.open.get(hostId) === link) this.open.delete(hostId);
	}
}
