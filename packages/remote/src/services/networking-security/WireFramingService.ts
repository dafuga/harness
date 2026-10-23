import type { Outgoing, Assembly, WireFramingOptions } from './WireFramingService.types';
import { RemoteFailure, remoteLimits } from '../../models/networking-security/Remote.types';
import { localTransport } from '../../models/networking-security/RemoteLocal.types';
import type { WirePart } from '../../models/networking-security/RemoteLocal.types';
import {
	bytesText,
	concatBytes,
	fromBase64,
	remoteBytes,
	toBase64
} from '../../utils/networking-security/remoteBytes';
/** Ordered frames written per step: events are small and must not trail far behind. */
const orderedBurst = 16;
const later = (step: () => void) => void setTimeout(step, 0);
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

function shaped(item: Partial<WirePart>): boolean {
	const exact = Object.keys(item).sort().join(',') === 'data,index,last,message,type';
	const numbered = count(item.message) && count(item.index);
	return exact && numbered && item.type === 'part' && typeof item.last === 'boolean';
}
/** The frame as a part, with its bytes. Anything else is refused before it is assembled. */
function partOf(frame: string, limit: number): { part: WirePart; bytes: Uint8Array } {
	if (frame.length > limit) throw new RemoteFailure('too-large');
	try {
		const item = (JSON.parse(frame) ?? {}) as Partial<WirePart>;
		if (!shaped(item) || typeof item.data !== 'string') throw new Error('Not a part.');
		return { part: item as WirePart, bytes: fromBase64(item.data) };
	} catch {
		throw new RemoteFailure('invalid-message');
	}
}

/**
 * Wire messages over a transport whose frames are bounded: a message is cut into parts, the
 * parts of several messages alternate so that a large answer delays nothing else, and a
 * receiver assembles each message strictly in order or refuses the connection.
 */
export class WireFramingService {
	private started = 0;
	private highest = -1;
	private pumping = false;
	private ordered: Outgoing[] = [];
	private others: Outgoing[] = [];
	private readonly assembling = new Map<number, Assembly>();
	constructor(private readonly options: WireFramingOptions) {}
	/** `ordered` messages (events) are completed in the order sent; the others take turns. */
	send(text: string, ordered = false): void {
		const bytes = remoteBytes(text);
		if (bytes.length > (this.options.outgoingBytes ?? remoteLimits.messageBytes))
			throw new RemoteFailure('too-large');
		const message: Outgoing = { bytes, offset: 0, id: null },
			lane = ordered ? this.ordered : this.others;
		lane.push(message);
		if (!this.pumping) return this.pump();
		/* A new message starts at once, unless ordered ones are ahead of it or no stream is free. */
		if (ordered && lane.length > 1) return;
		if (this.startable(message) && this.write(message)) lane.pop();
	}
	/** The whole message once its last part arrived, null before that. Throws on any violation. */
	accept(frame: string): string | null {
		const { frameBytes = remoteLimits.frameBytes, incomingBytes = remoteLimits.messageBytes } =
				this.options,
			{ part, bytes } = partOf(frame, frameBytes),
			assembly = this.assemblyOf(part);
		this.bounded(part, bytes, assembly);
		assembly.parts.push(bytes);
		assembly.size += bytes.length;
		assembly.next++;
		if (assembly.size > incomingBytes) throw new RemoteFailure('too-large');
		if (!part.last) return null;
		this.assembling.delete(part.message);
		try {
			return bytesText(concatBytes(...assembly.parts));
		} catch {
			throw new RemoteFailure('invalid-message');
		}
	}
	/** The connection ended: what was partly received or not yet sent is dropped. */
	reset(): void {
		this.assembling.clear();
		this.ordered = [];
		this.others = [];
	}
	/** A part that is empty without being the last, too large, or one too many, is refused. */
	private bounded(part: WirePart, bytes: Uint8Array, assembly: Assembly): void {
		const { chunkBytes = remoteLimits.chunkBytes, incomingBytes = remoteLimits.messageBytes } =
				this.options,
			most = this.options.parts ?? Math.ceil(incomingBytes / 1024) + 16;
		if (bytes.length === 0 && !part.last) throw new RemoteFailure('invalid-message');
		if (bytes.length > chunkBytes || assembly.next >= most) throw new RemoteFailure('too-large');
	}
	/** A message of one part needs no stream. One of several holds a stream until its last part. */
	private assemblyOf(part: WirePart): Assembly {
		const known = this.assembling.get(part.message);
		if (known && part.index === known.next) return known;
		if (known || part.index !== 0 || part.message <= this.highest)
			throw new RemoteFailure('invalid-message');
		const assembly = { parts: [], size: 0, next: 0 };
		this.highest = part.message;
		if (part.last) return assembly;
		if (this.assembling.size >= this.streams()) throw new RemoteFailure('too-many-requests');
		this.assembling.set(part.message, assembly);
		return assembly;
	}
	private streams(): number {
		return this.options.streams ?? localTransport.streams;
	}
	/**
	 * Whether a message may send its next part now. One that fits a single part always may; one
	 * of several parts starts only while the receiver has a stream free for it, and otherwise
	 * waits its turn, so that no number of simultaneous answers exceeds the bound.
	 */
	private startable(message: Outgoing): boolean {
		const chunk = this.options.chunkBytes ?? remoteLimits.chunkBytes;
		if (message.id !== null || message.bytes.length <= chunk) return true;
		const flowing = [...this.ordered.slice(0, 1), ...this.others].filter(
			(item) => item.id !== null && item.offset < item.bytes.length
		);
		return flowing.length < this.streams();
	}
	/** One frame of every waiting message, then the same again later, until none is left. */
	private pump(): void {
		this.pumping = true;
		for (let burst = 0; burst < orderedBurst && this.ordered.length > 0; burst++) {
			if (!this.startable(this.ordered[0])) break;
			if (this.write(this.ordered[0])) this.ordered.shift();
		}
		this.others = this.others.filter(
			(message) => !(this.startable(message) && this.write(message))
		);
		if (this.ordered.length + this.others.length === 0) this.pumping = false;
		else (this.options.defer ?? later)(() => this.pump());
	}
	/** Writes the next part of a message. True when that was its last. */
	private write(message: Outgoing): boolean {
		const chunk = this.options.chunkBytes ?? remoteLimits.chunkBytes,
			{ bytes, offset } = message,
			last = offset + chunk >= bytes.length;
		message.id ??= this.started++;
		const data = toBase64(bytes.subarray(offset, offset + chunk)),
			part: WirePart = { type: 'part', message: message.id, index: offset / chunk, last, data };
		message.offset += chunk;
		this.options.write(JSON.stringify(part));
		return last;
	}
}

export type { WireFramingOptions } from './WireFramingService.types';
