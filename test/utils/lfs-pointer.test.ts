import { expect, test } from 'vitest';
import { lfsPointer, lfsStored, parseLfsPointer } from '../../src/utils/lfsPointer';

const oid = 'a'.repeat(64);

test('lfsPointer writes the exact pointer text Git LFS reads', () => {
	expect(lfsPointer({ sha256: oid, bytes: 12 })).toBe(
		`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize 12\n`
	);
	expect(parseLfsPointer(lfsPointer({ sha256: oid, bytes: 12 }))).toEqual({
		sha256: oid,
		bytes: 12
	});
});

test('parseLfsPointer rejects anything that is not a pointer', () => {
	expect(parseLfsPointer('PNG bytes')).toBeUndefined();
	expect(
		parseLfsPointer(`version https://git-lfs.github.com/spec/v1\noid sha256:short\nsize 1\n`)
	).toBeUndefined();
	expect(
		parseLfsPointer(`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize -1\n`)
	).toBeUndefined();
});

test('lfsStored selects media by extension, whatever the case', () => {
	expect(['a/shot.png', 'b/SPOKEN.WAV', 'c/clip.webm'].map(lfsStored)).toEqual([true, true, true]);
	expect(['record.json', 'logs/unit.log', 'evidence/out.txt', 'png'].map(lfsStored)).toEqual([
		false,
		false,
		false,
		false
	]);
});
