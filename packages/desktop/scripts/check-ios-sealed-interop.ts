// @harness-uid u_wq3interop
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { SealedChainEntry } from '../../remote/src/models/networking-security/Sealed.types';
import { fromBase64Url, toBase64Url } from '../../remote/src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../remote/src/utils/networking-security/sealedChain';
import { sealedChainEntry } from '../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../remote/src/utils/networking-security/sealedDevice';
import {
	openSealedFrame,
	sealedFrame,
	sealedStreamKey
} from '../../remote/src/utils/networking-security/sealedFrame';
import {
	openSealedGrant,
	sealedGrant
} from '../../remote/src/utils/networking-security/sealedGrant';
import {
	openSealedRecord,
	sealedRecord
} from '../../remote/src/utils/networking-security/sealedRecord';
import {
	newRecoverySecret,
	openSealedRecovery,
	sealedRecovery
} from '../../remote/src/utils/networking-security/sealedRecovery';
import {
	newScopeKeys,
	scopeCommitment,
	scopeName,
	sealedObjectId,
	sealedScopeKeys
} from '../../remote/src/utils/networking-security/sealedScopeKeys';

/**
 * Live interop of the Swift sealed layer with the TypeScript core, in both directions: Swift
 * makes a chain, a grant (for a TypeScript device), a record, a frame and a recovery blob and
 * TypeScript opens them; TypeScript makes the same for Swift's device, which holds its keys in
 * the Secure Enclave when this Mac allows it, and Swift opens them. Nothing leaves a temp folder.
 */
const root = resolve(import.meta.dirname, '..');
const binary = resolve(root, '.cache/ios/sealed-interop');
const account = 'interop';
const folder = mkdtempSync(resolve(tmpdir(), 'sealed-interop-'));
const run = (command: string[]) =>
	Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
const read = (name: string) => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const text = (value: string) => new TextEncoder().encode(value);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const ok = (passed: boolean, name: string) => {
	console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}`);
	if (!passed) process.exitCode = 1;
};

async function judgeSwift(ts: Awaited<ReturnType<typeof sealedDevice>>) {
	const out = read('swift-out.json');
	const chain = await sealedChain(out.chain as SealedChainEntry[], { account });
	ok(
		chain.seq === 1 && chain.devices[ts.deviceId]?.active === true,
		'Swift chain verifies in TypeScript'
	);
	const keys = await openSealedGrant(out.grant, ts, chain);
	ok(scopeName(keys) === out.scopeKeys.scopeId, 'Swift HPKE grant opens in TypeScript');
	const record = await openSealedRecord<{ title: string }>(keys, fromBase64Url(out.record));
	ok(record.value.title === 'from swift' && record.header.revision === 4n, 'Swift record opens');
	const streamKey = await sealedStreamKey(keys, fromBase64Url(out.streamId));
	const frame = await openSealedFrame(keys, streamKey, fromBase64Url(out.frame));
	ok(decode(frame.data) === 'swift frame' && frame.header.counter === 7n, 'Swift frame opens');
	const recovered = await openSealedRecovery(fromBase64Url(out.recoverySecret), out.recovery);
	ok(recovered.deviceId === out.recoveryDevice, 'Swift recovery blob opens');
	return out;
}

async function makeForSwift(
	ts: Awaited<ReturnType<typeof sealedDevice>>,
	swift: Record<string, string>
) {
	const raw = newScopeKeys();
	const keys = await sealedScopeKeys(raw);
	const scope = scopeName(keys);
	const commitment = { scope, epoch: 0, commitment: toBase64Url(await scopeCommitment(raw)) };
	const tsPublic = sealedDevicePublic(ts, 'admin', [scope]);
	const phone = {
		deviceId: swift.deviceId,
		kemPublic: swift.kemPublic,
		signingPublic: swift.signingPublic,
		role: 'admin' as const,
		scopes: [scope]
	};
	const genesis = await sealedChainEntry(ts, {
		seq: 0,
		prev: '',
		at: 1,
		by: '',
		body: { type: 'genesis', account, devices: [tsPublic, phone], scopes: [commitment] }
	});
	const grant = await sealedGrant(account, raw, phone);
	const streamId = crypto.getRandomValues(new Uint8Array(16));
	const objectId = await sealedObjectId(keys, 'item', 'typescript');
	const recoveryDevice = await sealedDevice({ extractable: true });
	const secret = newRecoverySecret();
	writeFileSync(
		resolve(folder, 'ts-out.json'),
		JSON.stringify({
			chain: [genesis],
			grant,
			record: toBase64Url(
				await sealedRecord(
					keys,
					{ objectId, revision: 5n },
					{ kind: 'item', title: 'from typescript' }
				)
			),
			streamId: toBase64Url(streamId),
			frame: toBase64Url(
				await sealedFrame(keys, await sealedStreamKey(keys, streamId), {
					streamId,
					counter: 9n,
					data: text('typescript frame')
				})
			),
			recovery: await sealedRecovery(secret, recoveryDevice),
			recoverySecret: toBase64Url(secret),
			recoveryDevice: recoveryDevice.deviceId,
			recoverySigning: toBase64Url(recoveryDevice.signingPublic)
		})
	);
}

mkdirSync(folder, { recursive: true });
try {
	const ts = await sealedDevice({ extractable: true });
	writeFileSync(
		resolve(folder, 'ts-device.json'),
		JSON.stringify({
			deviceId: ts.deviceId,
			kemPublic: toBase64Url(ts.kemPublic),
			signingPublic: toBase64Url(ts.signingPublic)
		})
	);
	if (run([binary, 'export', folder]) !== 0) process.exitCode = 1;
	else {
		const swift = await judgeSwift(ts);
		await makeForSwift(ts, swift);
		if (run([binary, 'verify', folder]) !== 0) process.exitCode = 1;
	}
} finally {
	rmSync(folder, { recursive: true, force: true });
}
