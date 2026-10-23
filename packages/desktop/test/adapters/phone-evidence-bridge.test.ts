import type { Call, Answer } from './phone-evidence-bridge.test.types';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { CapacitorBridgeAdapter } from '../../src/adapters/capacitor-bridge-adapter/CapacitorBridgeAdapter';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../src/models/DesktopEvidence.types';
import type {
	RemoteMethod,
	RemoteNativePlugin,
	RemoteNativeStatus
} from '../../src/models/Environment.types';
import { largeArtifact, otherArtifact, unshownArtifact } from '../../src/utils/remoteArtifact';
import { damagedMedia, unreadableMedia } from '../../src/utils/remoteBinary';
const attached: RemoteMethod[] = ['listProjects', 'snapshot', 'entity', 'evidence', 'artifact'];
const online: RemoteNativeStatus = {
	state: 'online',
	origin: 'https://relay.example.invalid',
	host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
	device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
	grant: { projects: [{ id: 'local-1', name: 'One' }], agents: true },
	reason: null,
	lastOnlineAt: null,
	methods: attached
};
const pinned = 'c'.repeat(40);
const query: EntityEvidenceQuery = {
	projectId: 'local-1',
	entityId: 'page:activity',
	commit: 'a'.repeat(40),
	branch: 'main',
	mode: 'current'
};
/** Only what this bridge hands on untouched: the pinned revisions an artifact query repeats. */
const metadata = { identity: { notesRevision: pinned, evidenceRevision: pinned }, evidence: {} };
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const binary = (bytes: Uint8Array, mediaType = 'application/json') => ({
	encoding: 'base64',
	mediaType,
	byteLength: bytes.length,
	sha256: hash(bytes),
	data: Buffer.from(bytes).toString('base64')
});
const recorded = new TextEncoder().encode('{"ok":true}');
const capture = (bytes: Uint8Array, notesRevision = pinned): EvidenceArtifactQuery => ({
	...query,
	side: 'after',
	recordId: 'b'.repeat(64),
	scenarioId: 'titles-page',
	state: 'filled',
	evidenceId: 'screens',
	viewport: 'mobile',
	sha256: hash(bytes),
	notesRevision,
	evidenceRevision: pinned
});

function phone(value: unknown, status: RemoteNativeStatus | null = online, cachedAt?: string) {
	const request = vi.fn(async (call: Call): Promise<Answer> => {
		void call;
		if (value instanceof Error) throw value;
		return { value, cachedAt: cachedAt ?? null };
	});
	const plugin = { request, addListener: vi.fn() } as unknown as RemoteNativePlugin;
	const adapter = new CapacitorBridgeAdapter({ plugin });
	if (status) adapter.allow(status);
	return { adapter, bridge: adapter.connect(), request };
}
const found = (bridge: object) => {
	const surface = bridge as Record<string, unknown>;
	return [typeof surface.evidence, typeof surface.artifact];
};
const absent = ['undefined', 'undefined'];

test('evidence and artifact are found only while the computer attached them', () => {
	expect(found(phone(metadata).bridge)).toEqual(['function', 'function']);
	const reader: RemoteMethod[] = ['listProjects', 'snapshot', 'entity'];
	expect(found(phone(metadata, null).bridge)).toEqual(absent);
	expect(found(phone(metadata, { ...online, methods: reader }).bridge)).toEqual(absent);
	expect(found(phone(metadata, { ...online, methods: undefined }).bridge)).toEqual(absent);
	const half = phone(metadata, { ...online, methods: [...reader, 'evidence'] }).bridge;
	expect(found(half)).toEqual(['function', 'undefined']);
});

test('a changed attachment or a revocation takes both away, also from a caller that kept them', async () => {
	const { adapter, bridge, request } = phone(metadata);
	const { evidence, artifact } = bridge;
	adapter.allow({ ...online, methods: ['listProjects', 'snapshot', 'entity'] });
	expect(found(bridge)).toEqual(absent);
	await expect(evidence!(query)).rejects.toMatchObject({ code: 'method-denied' });
	await expect(artifact!(capture(recorded))).rejects.toMatchObject({ code: 'method-denied' });
	adapter.allow(online);
	expect(found(bridge)).toEqual(['function', 'function']);
	adapter.allow({ ...online, state: 'revoked', grant: null });
	expect(found(bridge)).toEqual(absent);
	expect(request).not.toHaveBeenCalled();
});

test('evidence is one read that names its project and is handed on as the computer gave it', async () => {
	const { bridge, request } = phone(metadata);
	expect(await bridge.evidence!(query)).toEqual(metadata);
	expect(request).toHaveBeenCalledExactlyOnceWith({ method: 'evidence', input: query });
});

test('an artifact is asked by its whole binding and decoded to its checked bytes', async () => {
	const { bridge, request } = phone(binary(recorded));
	const read = await bridge.artifact!(capture(recorded));
	expect(Array.from(read.bytes)).toEqual(Array.from(recorded));
	expect(read.bytes).toBeInstanceOf(Uint8Array);
	expect({ mediaType: read.mediaType, sha256: read.sha256 }).toEqual({
		mediaType: 'application/json',
		sha256: hash(recorded)
	});
	expect(request).toHaveBeenCalledExactlyOnceWith({ method: 'artifact', input: capture(recorded) });
});

test('an artifact whose data, hash or length was changed on the way is refused', async () => {
	const good = binary(recorded);
	const other = Buffer.from(new TextEncoder().encode('{"ok":false}')).toString('base64');
	const tampered: [object, string][] = [
		[{ ...good, data: other }, damagedMedia],
		[{ ...good, byteLength: recorded.length + 1 }, damagedMedia],
		[{ ...good, sha256: 'f'.repeat(64) }, otherArtifact],
		[{ ...good, data: `${good.data}%` }, unreadableMedia],
		[{ ...good, encoding: 'hex' }, unreadableMedia]
	];
	for (const [value, why] of tampered) {
		expect(why.length).toBeGreaterThan(20);
		await expect(phone(value).bridge.artifact!(capture(recorded))).rejects.toThrow(why);
	}
	expect((await phone(good).bridge.artifact!(capture(recorded))).sha256).toBe(hash(recorded));
});

test('markup and an artifact above 11 MiB are refused, though their bytes are intact', async () => {
	const page = new TextEncoder().encode('<script>alert(1)</script>');
	for (const mediaType of ['text/html', 'image/svg+xml', 'application/javascript'])
		await expect(phone(binary(page, mediaType)).bridge.artifact!(capture(page))).rejects.toThrow(
			unshownArtifact
		);
	const more = new Uint8Array(11 * 1024 * 1024 + 1).fill(7);
	/** Only the words are compared: a wrongly read artifact of this size is not printed. */
	const refusal = await phone(binary(more, 'image/png')).bridge.artifact!(capture(more)).then(
		() => 'read',
		(cause: Error) => cause.message
	);
	expect(refusal).toBe(largeArtifact);
	const text = await phone(binary(page, 'text/plain; charset=utf-8')).bridge.artifact!(
		capture(page)
	);
	expect(text.mediaType).toBe('text/plain; charset=utf-8');
});

test('while the computer is away both are still found and answered from the kept copy', async () => {
	const cachedAt = '2026-10-12T07:30:00.000Z';
	const away: RemoteNativeStatus = { ...online, state: 'offline' };
	const kept = phone(metadata, away, cachedAt);
	expect(found(kept.bridge)).toEqual(['function', 'function']);
	expect(await kept.bridge.evidence!(query)).toEqual(metadata);
	const copy = phone(binary(recorded), away, cachedAt);
	const read = await copy.bridge.artifact!(capture(recorded));
	expect(Array.from(read.bytes)).toEqual(Array.from(recorded));
	expect(copy.request).toHaveBeenCalledExactlyOnceWith({
		method: 'artifact',
		input: capture(recorded)
	});
});

test('a kept copy that is not the artifact that was asked for is never shown', async () => {
	const away: RemoteNativeStatus = { ...online, state: 'offline' };
	const earlier = new TextEncoder().encode('{"ok":"earlier notes"}');
	const stale = phone(binary(earlier), away, '2026-10-12T07:30:00.000Z');
	await expect(stale.bridge.artifact!(capture(recorded))).rejects.toThrow(otherArtifact);
	const none = Object.assign(new Error('The computer is not connected.'), { code: 'offline' });
	const later = capture(recorded, 'e'.repeat(40));
	await expect(phone(none, away).bridge.artifact!(later)).rejects.toMatchObject({
		code: 'offline',
		message: 'The computer is not connected.'
	});
	await expect(phone(none, away).bridge.evidence!(query)).rejects.toMatchObject({
		code: 'offline'
	});
});
