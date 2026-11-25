// @harness-uid u_jsxj7qkjr5
import { toBase64Url } from '../../../../remote/src/utils/networking-security/remoteBytes';
import {
	openSealedFrame,
	sealedFrameHeader,
	sealedStreamKey
} from '../../../../remote/src/utils/networking-security/sealedFrame';
import { sealedUnpadding } from '../../../../remote/src/utils/networking-security/sealedPadding';
import type { SealedLiveNotice, SealedLiveOptions, StreamTail } from './SealedLive.types';

/** Subscribes to account pokes and authenticates numbered frames before emitting their text. */
export class SealedLive {
	private socket: WebSocket | undefined;
	private retry: ReturnType<typeof setTimeout> | undefined;
	private delay = 1000;
	private ring = 0;
	private pending = Promise.resolve();
	private tails = new Map<string, StreamTail>();
	private stopped = false;

	constructor(private readonly options: SealedLiveOptions) {}

	connect(): void {
		if (this.stopped || this.socket || !this.options.scopes.length) return;
		const url = new URL('/api/sync/v1/live', location.href);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		// A public device id selects the subscription. The same-origin Google cookie authenticates.
		url.searchParams.set('device', this.options.device);
		const socket = new WebSocket(url);
		this.socket = socket;
		socket.binaryType = 'arraybuffer';
		socket.onopen = () => {
			this.delay = 1000;
			socket.send(
				JSON.stringify({ t: 'subscribe', scopes: this.options.scopes, after: this.ring })
			);
			this.options.onObjects();
		};
		socket.onmessage = ({ data }) => {
			this.pending = this.pending.then(() => this.receive(data)).catch(() => {});
		};
		socket.onclose = () => {
			if (this.socket !== socket || this.stopped) return;
			this.socket = undefined;
			this.retry = setTimeout(() => this.connect(), this.delay);
			this.delay = Math.min(this.delay * 2, 30_000);
		};
	}

	close(): void {
		this.stopped = true;
		clearTimeout(this.retry);
		this.socket?.close();
		this.socket = undefined;
		this.tails.clear();
	}

	private async receive(data: unknown): Promise<void> {
		if (this.stopped) return;
		if (typeof data === 'string') return this.receiveNotice(data);
		if (!(data instanceof ArrayBuffer) || data.byteLength < 8 || data.byteLength > 262_152) return;
		const ring = new DataView(data).getBigUint64(0);
		if (ring > BigInt(Number.MAX_SAFE_INTEGER) || Number(ring) <= this.ring) return;
		await this.openFrame(new Uint8Array(data, 8));
		this.ring = Number(ring);
	}

	private receiveNotice(data: string): void {
		const message: SealedLiveNotice = JSON.parse(data);
		if (message.t === 'poke' && message.kind === 'objects') this.options.onObjects();
		if (
			message.t !== 'subscribed' ||
			!Number.isSafeInteger(message.ring) ||
			Number(message.ring) >= this.ring
		)
			return;
		this.ring = 0;
		this.socket?.send(JSON.stringify({ t: 'subscribe', scopes: this.options.scopes, after: 0 }));
	}

	private async openFrame(frame: Uint8Array): Promise<void> {
		const header = sealedFrameHeader(frame);
		const scope = toBase64Url(header.scopeId);
		if (!this.options.scopes.includes(scope)) return;
		const keys = await this.options.readKeys(scope, header.epoch);
		if (!keys) return;
		const stream = JSON.stringify([scope, toBase64Url(header.streamId)]);
		const known = this.tails.get(stream);
		const key = known?.key ?? (await sealedStreamKey(keys, header.streamId));
		if (known && header.counter <= known.counter) return;
		const { data } = await openSealedFrame(keys, key, frame);
		if (this.stopped) return;
		const tail = appendTail(key, header.counter, data, known);
		if (!known && this.tails.size >= 64) this.tails.delete(this.tails.keys().next().value!);
		this.tails.set(stream, tail);
		this.options.onOutput(stream, tail.chunks);
	}
}

function appendTail(
	key: CryptoKey,
	counter: bigint,
	data: Uint8Array,
	known?: StreamTail
): StreamTail {
	const gap = isFrameGap(known, counter);
	const decoder = gap ? new TextDecoder() : (known?.decoder ?? new TextDecoder());
	const text = (
		(gap ? '\n…\n' : '') + decoder.decode(sealedUnpadding(data), { stream: true })
	).slice(-256_000);
	const chunks = [...(known?.chunks ?? []), { counter: String(counter), text }];
	let chars = (known?.chars ?? 0) + text.length;
	while (overTailLimit(chars, chunks.length)) chars -= chunks.shift()!.text.length;
	return { key, counter, decoder, chunks, chars };
}

function isFrameGap(known: StreamTail | undefined, counter: bigint): boolean {
	return known !== undefined && counter !== known.counter + 1n;
}

function overTailLimit(chars: number, chunks: number): boolean {
	return chars > 256_000 || chunks > 256;
}
