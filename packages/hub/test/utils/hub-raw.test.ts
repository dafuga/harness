import { expect, test } from 'vitest';
import { hubMaterializedHash, hubBlobProfile } from '../../src/utils/hubRaw';
test('LFS cache binding requires exact pointer hash and length', async () => {
	const encode = (v: string) => new TextEncoder().encode(v),
		hash = 'a'.repeat(64);
	const pointer = encode(
		`version https://git-lfs.github.com/spec/v1\noid sha256:${hash}\nsize 42\n`
	);
	expect(await hubMaterializedHash(pointer, hash)).toEqual({ hash, size: 42, lfs: true });
	await expect(hubMaterializedHash(pointer, 'b'.repeat(64))).rejects.toThrow();
	await expect(
		hubMaterializedHash(encode('version https://git-lfs.github.com/spec/v1\nwrong'), hash)
	).rejects.toThrow();
	expect(
		(await hubBlobProfile('source', 'a/'.repeat(300) + 'file.ts', 'c'.repeat(40))).length
	).toBeLessThan(200);
});
