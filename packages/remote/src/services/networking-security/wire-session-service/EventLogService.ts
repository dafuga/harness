import type { EventReplay } from './EventLogService.types';
import { remoteLimits } from '../../../models/networking-security/Remote.types';
import type {
	RemoteResume,
	WireChannel,
	WireEvent
} from '../../../models/networking-security/Remote.types';
import { randomId } from '../../../utils/networking-security/remoteIdentity';

/** The events of one client session: one sequence, a bounded window, replay from a cursor. */
export class EventLogService {
	/** Changes with every log, so a cursor of an earlier host process is recognised as a gap. */
	readonly epoch: string;
	private readonly capacity: number;
	private retained: WireEvent[] = [];
	private last = 0;
	constructor(options: { epoch?: string; capacity?: number } = {}) {
		this.epoch = options.epoch ?? randomId(16);
		this.capacity = options.capacity ?? remoteLimits.eventLog;
	}
	get sequence(): number {
		return this.last;
	}
	append(channel: WireChannel, value: unknown): WireEvent {
		const event: WireEvent = { type: 'event', channel, sequence: ++this.last, value };
		this.retained.push(event);
		if (this.retained.length > this.capacity) this.retained.shift();
		return event;
	}
	/** What followed the cursor, or a gap when that can no longer be told. */
	since(resume: RemoteResume | null): EventReplay {
		if (!resume) return { replay: 'none', events: [] };
		const before = this.last - this.retained.length;
		const known =
			resume.epoch === this.epoch && resume.sequence <= this.last && resume.sequence >= before;
		if (!known) return { replay: 'gap', events: [] };
		return {
			replay: 'resumed',
			events: this.retained.filter((event) => event.sequence > resume.sequence)
		};
	}
}

export type { EventReplay } from './EventLogService.types';
