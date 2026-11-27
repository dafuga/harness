// @harness-uid u_fprc5ohvkc
import type {
	XBlock,
	XDigestConfig,
	XDigestReport,
	XDigestState,
	XFeeds
} from '../../core/agents-providers/xDigest.types';
import type { XDigestPorts, XDigestRunOptions } from './XDigestService.types';
import { formatXDigest } from './x-digest-service/formatXDigest';
import { selectPosts } from './x-digest-service/selectPosts';
import { xDigestQuestion } from './x-digest-service/xDigestQuestion';

const maxSeen = 4000;

/** One daily digest: read, keep what is new, queue it once. No model reads the feed. */
export class XDigestService {
	constructor(
		private readonly config: XDigestConfig,
		private readonly ports: XDigestPorts
	) {}

	async run(options: XDigestRunOptions = {}): Promise<XDigestReport> {
		const state = await this.ports.state.load();
		const day = lisbonDay(this.ports.now?.() ?? new Date());
		const held = this.held(state, day, options);
		if (held) return { status: held };
		const read = await this.ports.reader.read(this.config.limits.scan);
		if (read.status !== 'ok') {
			if (!options.dryRun) await this.stopped(state, day, read.status);
			return { status: read.status };
		}
		const picked = selectPosts(read.feeds, new Set(state.seen), this.config.limits);
		const counts = {
			mentions: picked.mentions.length,
			following: picked.following.length,
			forYou: picked.forYou.length
		};
		if (options.dryRun) return { status: 'dry-run', counts };
		await this.publish(state, day, picked);
		return { status: 'queued', counts };
	}

	/** Why nothing should even be read now. */
	private held(state: XDigestState, day: string, options: XDigestRunOptions) {
		if (state.lastQueuedDay === day && !options.force && !options.dryRun) return 'already-queued';
		return this.ports.attended() ? 'attended' : undefined;
	}

	/** The outbox is written first: posts are only forgotten once the sender can fetch them. */
	private async publish(state: XDigestState, day: string, picked: XFeeds): Promise<void> {
		await this.ports.outbox.write({ version: 1, day, messages: formatXDigest(picked, day) });
		const ids = [...picked.mentions, ...picked.following, ...picked.forYou].map((post) => post.id);
		state.seen = [...state.seen, ...ids].slice(-maxSeen);
		state.lastQueuedDay = day;
		delete state.alerted;
		await this.ports.state.save(state);
	}

	/** Tells the sender why nothing is coming, and asks Daniel once per problem. */
	private async stopped(state: XDigestState, day: string, blocked: XBlock): Promise<void> {
		await this.ports.outbox.write({ version: 1, day, blocked });
		if (state.alerted === blocked) return;
		await this.ports.ask(xDigestQuestion(blocked, this.config.viewer.url));
		state.alerted = blocked;
		await this.ports.state.save(state);
	}
}

function lisbonDay(date: Date): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(date);
}
