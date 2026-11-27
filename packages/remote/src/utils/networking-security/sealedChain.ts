// @harness-uid u_7tgdli7pdw
import type {
	SealedChainBody,
	SealedChainEntry,
	SealedChainState,
	SealedDevicePublic,
	SealedScopeCommitment
} from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import type { Body, ChainExpectation } from './sealedChain.types';
import { chainEntryHash, verifyChainEntry } from './sealedChainEntry';

/** Which signer roles may append which entry types. Bots sign nothing. */
const signers: Record<SealedChainBody['type'], string[]> = {
	genesis: ['admin'],
	enroll: ['admin', 'recovery'],
	revoke: ['admin'],
	scope: ['admin'],
	rotate: ['admin']
};

function fail(message: string): never {
	throw new SealedError(`Device chain refused: ${message}`);
}

function addScope(state: SealedChainState, scope: SealedScopeCommitment): void {
	if (state.scopes[scope.scope] || scope.epoch !== 0) fail('scope exists or starts after epoch 0');
	state.scopes[scope.scope] = { epoch: 0, commitments: { 0: scope.commitment }, stale: false };
}

function addDevice(state: SealedChainState, device: SealedDevicePublic): void {
	if (state.devices[device.deviceId]) fail('device id reused');
	if (device.scopes.some((scope) => !state.scopes[scope])) fail('device holds an unknown scope');
	state.devices[device.deviceId] = { ...device, active: true };
}

function genesis(
	entry: SealedChainEntry,
	body: Body<'genesis'>,
	account: string
): SealedChainState {
	if (entry.seq !== 0 || entry.prev !== '') fail('genesis must come first');
	if (body.account !== account) fail('chain belongs to another account');
	const state: SealedChainState = { account, seq: 0, head: '', devices: {}, scopes: {} };
	for (const scope of body.scopes) addScope(state, scope);
	for (const device of body.devices) addDevice(state, device);
	return state;
}

function revoke(state: SealedChainState, body: Body<'revoke'>): void {
	const device = state.devices[body.device];
	if (!device?.active) fail('revoked device is not active');
	device.active = false;
	for (const scope of device.scopes) state.scopes[scope]!.stale = true;
}

function rotate(state: SealedChainState, body: Body<'rotate'>): void {
	const scope = state.scopes[body.commitment.scope];
	if (!scope || body.commitment.epoch !== scope.epoch + 1) fail('rotation skips an epoch');
	scope.epoch = body.commitment.epoch;
	scope.commitments[scope.epoch] = body.commitment.commitment;
	scope.stale = false;
}

function grantScope(state: SealedChainState, body: Body<'scope'>, by: string): void {
	addScope(state, body.commitment);
	for (const id of new Set([by, ...body.devices])) {
		const device = state.devices[id];
		if (!device?.active) fail('scope granted to an inactive device');
		device.scopes = [...device.scopes, body.commitment.scope].sort();
	}
}

function apply(state: SealedChainState, entry: SealedChainEntry): void {
	const body = entry.body;
	if (body.type === 'enroll') {
		if (body.device.role === 'recovery') fail('only genesis creates the recovery device');
		addDevice(state, body.device);
	} else if (body.type === 'revoke') revoke(state, body);
	else if (body.type === 'rotate') rotate(state, body);
	else if (body.type === 'scope') grantScope(state, body, entry.by);
	else fail('genesis appears twice');
}

function signerKey(state: SealedChainState | null, entry: SealedChainEntry): string {
	const body = entry.body;
	const signer =
		body.type === 'genesis'
			? body.devices.find((device) => device.deviceId === entry.by)
			: state?.devices[entry.by];
	if (!signer || (state && !state.devices[entry.by]?.active))
		fail('signer is not an active device');
	if (!signers[body.type].includes(signer.role)) fail(`${signer.role} cannot sign ${body.type}`);
	return signer.signingPublic;
}

async function checkSigned(
	state: SealedChainState | null,
	entry: SealedChainEntry,
	index: number
): Promise<void> {
	if (entry.seq !== index || entry.prev !== (state?.head ?? ''))
		fail(`entry ${index} is out of order`);
	if (!(await verifyChainEntry(entry, signerKey(state, entry))))
		fail(`entry ${index} has a bad signature`);
}

async function verifyEntry(
	state: SealedChainState | null,
	entry: SealedChainEntry,
	index: number,
	expect: ChainExpectation
): Promise<SealedChainState> {
	await checkSigned(state, entry, index);
	const next = entry.body.type === 'genesis' ? genesis(entry, entry.body, expect.account) : state;
	if (!next) fail('chain has no genesis');
	if (next === state) apply(next, entry);
	next.seq = index;
	next.head = await chainEntryHash(entry);
	if (expect.pin?.seq === index && expect.pin.head !== next.head) fail('chain forked from the pin');
	return next;
}

/**
 * Verifies a whole device chain from genesis and returns who holds which scopes. A pin from an
 * earlier verification must still be on the chain, so a server cannot roll a client back or fork it.
 */
export async function sealedChain(
	entries: SealedChainEntry[],
	expect: ChainExpectation
): Promise<SealedChainState> {
	let state: SealedChainState | null = null;
	for (const [index, entry] of entries.entries())
		state = await verifyEntry(state, entry, index, expect);
	if (!state) fail('chain is empty');
	if (expect.pin && state.seq < expect.pin.seq) fail('chain is older than the pin');
	return state;
}
