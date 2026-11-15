import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { desktopPatchConfig } from '../../src/configs/development-tooling/desktopPatchConfig';

const oldPath = resolve(import.meta.dirname, '../../src/configs/desktopPatchConfig.ts');

test('desktop patch is pinned to the inspected installed build', () => {
	expect(desktopPatchConfig.version).toBe('26.1002.52244');
});

test('desktop patch has no re-export stub left at its old path', () => {
	expect(existsSync(oldPath)).toBe(false);
});
