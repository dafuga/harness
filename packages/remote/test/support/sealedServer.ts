import { toBase64Url } from '../../src/utils/networking-security/remoteBytes';

/**
 * A stand-in for the Hub sync API, D1, R2 and the account Durable Object. It keeps exactly what
 * the server would keep and logs every request line and body, so a test can prove none of it
 * holds plaintext. Like the real server it checks only sequence numbers, never contents.
 */
export class SealedServer {
	readonly requests: string[] = [];
	readonly chain: string[] = [];
	readonly grants = new Map<string, string>();
	readonly ops = new Map<string, string[]>();
	readonly objects = new Map<string, string>();
	readonly frames: string[] = [];
	readonly enrollments = new Map<string, string>();

	private log(line: string, body: string): void {
		this.requests.push(line, body);
	}

	appendChain(body: string): void {
		this.log('POST /api/sync/v1/chain', body);
		const seq = (JSON.parse(body) as { seq: number }).seq;
		if (seq !== this.chain.length) throw new Error('409 chain conflict');
		this.chain.push(body);
	}

	readChain(): string[] {
		this.log('GET /api/sync/v1/chain?after=-1', '');
		return [...this.chain];
	}

	putGrant(body: string): void {
		this.log('POST /api/sync/v1/grants', body);
		const grant = JSON.parse(body) as { scope: string; epoch: number; device: string };
		this.grants.set(`${grant.scope}/${grant.epoch}/${grant.device}`, body);
	}

	grantsFor(device: string): string[] {
		this.log(`GET /api/sync/v1/grants?device=${device}`, '');
		return [...this.grants.entries()]
			.filter(([key]) => key.endsWith(`/${device}`))
			.map(([, value]) => value);
	}

	postOps(scope: string, envelopes: Uint8Array[]): number {
		const body = JSON.stringify(envelopes.map(toBase64Url));
		this.log(`POST /api/sync/v1/ops/${scope}`, body);
		const log = this.ops.get(scope) ?? [];
		log.push(...(JSON.parse(body) as string[]));
		this.ops.set(scope, log);
		return log.length;
	}

	readOps(scope: string, after: number): string[] {
		this.log(`GET /api/sync/v1/ops/${scope}?after=${after}&limit=100`, '');
		return (this.ops.get(scope) ?? []).slice(after);
	}

	putObject(scope: string, id: string, envelope: Uint8Array): void {
		this.log(`PUT /api/sync/v1/objects/${scope}/${id}`, toBase64Url(envelope));
		this.objects.set(`${scope}/${id}`, toBase64Url(envelope));
	}

	relayFrame(frame: Uint8Array): string {
		this.log('WS /api/sync/v1/live frame', toBase64Url(frame));
		this.frames.push(toBase64Url(frame));
		return toBase64Url(frame);
	}

	enrollStep(id: string, body: string): void {
		this.log(`POST /api/sync/v1/enroll/${id}`, body);
		this.enrollments.set(`${id}/${this.enrollments.size}`, body);
	}

	/** Everything a Cloudflare operator could read: request log plus every stored row and object. */
	captured(): string[] {
		return [
			...this.requests,
			...this.chain,
			...this.grants.keys(),
			...this.grants.values(),
			...[...this.ops.entries()].flat(2),
			...this.objects.keys(),
			...this.objects.values(),
			...this.frames,
			...this.enrollments.values()
		];
	}
}
