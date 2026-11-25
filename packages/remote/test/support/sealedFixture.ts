import type {
	RawScopeKeys,
	SealedChainEntry,
	SealedDeviceKeys,
	SealedRole
} from '../../src/models/networking-security/Sealed.types';
import type { SealedAccount } from './sealedFixture.types';
import { toBase64Url } from '../../src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../src/utils/networking-security/sealedChain';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../src/utils/networking-security/sealedChainEntry';
import { sealedDevice, sealedDevicePublic } from '../../src/utils/networking-security/sealedDevice';
import { newScopeKeys, scopeCommitment } from '../../src/utils/networking-security/sealedScopeKeys';

export const account = 'actor-fixture-1';

export async function commitmentOf(raw: RawScopeKeys) {
	return {
		scope: toBase64Url(raw.scopeId),
		epoch: raw.epoch,
		commitment: toBase64Url(await scopeCommitment(raw))
	};
}

export async function sealedAccount(): Promise<SealedAccount> {
	const phone = await sealedDevice(),
		recovery = await sealedDevice({ extractable: true }),
		scope = newScopeKeys();
	const name = toBase64Url(scope.scopeId);
	const genesis = await sealedChainEntry(phone, {
		seq: 0,
		prev: '',
		at: 1,
		by: phone.deviceId,
		body: {
			type: 'genesis',
			account,
			devices: [
				sealedDevicePublic(phone, 'admin', [name]),
				sealedDevicePublic(recovery, 'recovery', [name])
			],
			scopes: [await commitmentOf(scope)]
		}
	});
	const entries = [genesis];
	return { phone, recovery, scope, entries, state: await sealedChain(entries, { account }) };
}

/** Appends a signed entry with the right seq and prev, then re-verifies the whole chain. */
export async function append(
	fixture: SealedAccount,
	signer: SealedDeviceKeys,
	body: SealedChainEntry['body']
): Promise<SealedChainEntry> {
	const last = fixture.entries.at(-1)!;
	const entry = await sealedChainEntry(signer, {
		seq: last.seq + 1,
		prev: await chainEntryHash(last),
		at: last.at + 1,
		by: signer.deviceId,
		body
	});
	fixture.entries.push(entry);
	fixture.state = await sealedChain(fixture.entries, { account });
	return entry;
}

export async function enroll(
	fixture: SealedAccount,
	signer: SealedDeviceKeys,
	role: SealedRole,
	scopes = [toBase64Url(fixture.scope.scopeId)]
): Promise<SealedDeviceKeys> {
	const device = await sealedDevice();
	await append(fixture, signer, {
		type: 'enroll',
		device: sealedDevicePublic(device, role, scopes)
	});
	return device;
}
