import { expect, test } from 'vitest';
import type { Checkpoint } from '../../game/src/index';
import {
	isRevisionConflict,
	replaceCheckpoint,
	withoutCheckpoint
} from '../src/components/game-authoring/game-workspace/checkpointEdits';

const node = (id: string, requires: string[] = []) => ({ id, requires }) as unknown as Checkpoint;

test('replacing swaps only the named checkpoint and keeps the order', () => {
	const next = node('b', ['a']);
	expect(replaceCheckpoint([node('a'), node('b')], 'b', next)).toEqual([node('a'), next]);
	expect(replaceCheckpoint([node('a')], null, next)).toEqual([node('a')]);
});

test('removing drops the checkpoint and every requirement of it', () => {
	const rest = withoutCheckpoint([node('a'), node('b', ['a']), node('c', ['a', 'b'])], 'a');
	expect(rest).toEqual([node('b'), node('c', ['b'])]);
});

test('a revision conflict is recognised by its wording', () => {
	expect(isRevisionConflict('The revision is stale')).toBe(true);
	expect(isRevisionConflict('Disk full')).toBe(false);
});
