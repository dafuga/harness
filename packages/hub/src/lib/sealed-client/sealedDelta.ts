// @harness-uid u_cx2e2nfvja
import { SealedError } from '../../../../remote/src/models/networking-security/SealedError';
import type {
	ScopeKeys,
	SealedChainState,
	SealedDeviceKeys,
	SealedGrant
} from '../../../../remote/src/models/networking-security/Sealed.types';
import {
	fromBase64Url,
	toBase64Url
} from '../../../../remote/src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../../../remote/src/utils/networking-security/sealedChain';
import {
	openSealedRecord,
	sealedRecordHeader
} from '../../../../remote/src/utils/networking-security/sealedRecord';
import type { SealedBrowserCache } from './SealedBrowserCache';
import type { SealedEnrollment, SealedObject, StoredGrant } from './SealedBrowserCache.types';
import type {
	ChainPage,
	GrantList,
	ObjectChange,
	ObjectChanges,
	RefreshedEnrollment
} from './sealedDelta.types';
import { committedKeys } from './sealedEnrollment';

const prefix = '/api/sync/v1';

export function sealedReader(deviceId: string, signal: AbortSignal) {
	return async (path: string): Promise<Response> => {
		const response = await fetch(prefix + path, {
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { 'X-Harness-Device': deviceId },
			signal
		});
		if (!response.ok) throw new SealedError('Sealed Sync request failed.');
		return response;
	};
}

export async function refreshSealedEnrollment(
	read: ReturnType<typeof sealedReader>,
	cache: SealedBrowserCache,
	enrollment: SealedEnrollment,
	pin: SealedChainState
): Promise<RefreshedEnrollment> {
	const entries = enrollment.entries.slice();
	let more = true;
	while (more) {
		const page: ChainPage = await (await read(`/chain?after=${entries.length - 1}`)).json();
		if (page.more && !page.entries.length) throw new SealedError('Device chain did not advance.');
		entries.push(...page.entries);
		more = page.more;
	}
	const chain =
		entries.length > enrollment.entries.length
			? await sealedChain(entries, { account: pin.account, pin })
			: pin;
	const next = { ...enrollment, entries };
	if (chain !== pin && !(await cache.saveEnrollment(next, [])))
		throw new SealedError('Device chain changed.');
	const grants = await missingGrants(read, cache, enrollment, chain).catch(() => []);
	const keysChanged = grants.length > 0 && (await cache.saveEnrollment(next, grants));
	return { enrollment: next, chain, keysChanged };
}

async function missingGrants(
	read: ReturnType<typeof sealedReader>,
	cache: SealedBrowserCache,
	enrollment: SealedEnrollment,
	chain: SealedChainState
): Promise<StoredGrant[]> {
	const self = chain.devices[enrollment.deviceId];
	if (!self?.active || !enrollment.device) return [];
	const needed = await Promise.all(
		self.scopes.map(async (scope) => {
			const state = chain.scopes[scope];
			return (
				!state.stale &&
				!committedKeys(await cache.keys(scope, state.epoch), state.commitments[state.epoch])
			);
		})
	);
	if (!needed.some(Boolean)) return [];
	const { grants }: GrantList = await (await read(`/grants?device=${enrollment.deviceId}`)).json();
	return unwrapGrants(cache, enrollment.device, chain, grants);
}

async function unwrapGrants(
	cache: SealedBrowserCache,
	device: SealedDeviceKeys,
	chain: SealedChainState,
	grants: SealedGrant[]
): Promise<StoredGrant[]> {
	const scopes = chain.devices[device.deviceId].scopes;
	const { openSealedGrant } =
		await import('../../../../remote/src/utils/networking-security/sealedGrant');
	const accepted: StoredGrant[] = [];
	for (const grant of grants) {
		const commitment = chain.scopes[grant.scope]?.commitments[grant.epoch];
		if (!scopes.includes(grant.scope) || !commitment) continue;
		if (committedKeys(await cache.keys(grant.scope, grant.epoch), commitment)) continue;
		try {
			const keys = await openSealedGrant(grant, device, chain);
			accepted.push({ scope: grant.scope, keys });
		} catch {
			// Untrusted or corrupted grants cannot replace verified local keys.
		}
	}
	return accepted;
}

export async function syncSealedObjects(
	read: ReturnType<typeof sealedReader>,
	cache: SealedBrowserCache,
	scope: string,
	keys: (epoch: number) => Promise<ScopeKeys | undefined>
): Promise<void> {
	const path = `/objects/${scope}`;
	let more = true;
	while (more) {
		const after = await cache.cursor(scope);
		const page: ObjectChanges = await (await read(`${path}?after=${after}`)).json();
		checkPage(page, after);
		if (!page.objects.length) return;
		const objects: SealedObject[] = [];
		for (const item of page.objects)
			objects.push(await readObject(read, { path, scope, item, keys }));
		const committed = await cache.applyPage(scope, { after, next: page.next, objects });
		more = page.more || !committed;
	}
}

function checkPage(page: ObjectChanges, after: number): void {
	let last = after;
	for (const item of page.objects) {
		if (
			!Number.isSafeInteger(item.change) ||
			item.change <= last ||
			!/^[\w-]{43}$/.test(item.id) ||
			!Number.isSafeInteger(item.revision) ||
			item.revision < 0
		)
			throw new SealedError('Invalid sealed object page.');
		last = item.change;
	}
	if (page.next !== last || (page.more && last === after))
		throw new SealedError('Invalid scope cursor.');
}

async function readObject(
	read: ReturnType<typeof sealedReader>,
	input: {
		path: string;
		scope: string;
		item: ObjectChange;
		keys: (epoch: number) => Promise<ScopeKeys | undefined>;
	}
): Promise<SealedObject> {
	const envelope = await (await read(`${input.path}/${input.item.id}`)).text();
	const bytes = fromBase64Url(envelope);
	const header = sealedRecordHeader(bytes);
	const revision = Number(header.revision);
	if (
		toBase64Url(header.scopeId) !== input.scope ||
		toBase64Url(header.objectId) !== input.item.id ||
		!Number.isSafeInteger(revision) ||
		revision < input.item.revision
	)
		throw new SealedError('Sealed object does not match its listing.');
	const keys = await input.keys(header.epoch);
	// A newly approved device may have only current-epoch grants. Keep older envelopes
	// opaque so they cannot block paging to the current records.
	if (keys) await openSealedRecord(keys, bytes);
	return { id: input.item.id, revision, envelope };
}
