import type { PlannedFile } from '../../core/development-tooling/files';
import { toKebabCase, toCamelCase, toPascalCase } from '../../helpers/strings/case';
import { fail } from '../../core/development-tooling/errors';
import type { PieceContext } from '../development-tooling/pieces';

export function gameViewFiles(name: string, { dimension }: PieceContext): PlannedFile[] {
	if (!dimension) fail('A game view needs harness.dimension 2d or 3d in package.json.');
	const symbol = toCamelCase(name) + 'ViewConfig';
	return [
		{
			path: 'src/configs/' + symbol + '.ts',
			contents: `import type { GameView } from '../lib/game/models/Game.types';\n\nexport const ${symbol}: GameView = {\n\tid: '${toKebabCase(name)}',\n\ttitle: '${toPascalCase(name)}',\n\tdimension: '${dimension}',\n\tstyle: '',\n\tcheckpoints: []\n};\n`
		}
	];
}
export function mechanicFiles(name: string): PlannedFile[] {
	const id = toKebabCase(name),
		symbol = toCamelCase(name);
	return [
		{
			path: 'src/utils/' + symbol + '.ts',
			contents: `import type { GameState, GameInput } from '../lib/game/models/Game.types';\n\nexport function ${symbol}(state: Readonly<GameState>, input: Readonly<GameInput>): GameState {\n\tvoid state;\n\tvoid input;\n\treturn {};\n}\n`
		},
		{
			path: 'test/' + id + '.test.ts',
			contents: `import { expect, test } from 'vitest';\nimport { ${symbol} } from '../src/utils/${symbol}';\n\ntest('${id} produces an independent state patch', () => {\n\texpect(${symbol}({}, { x: 0, y: 0 })).toEqual({});\n});\n`
		}
	];
}
export function checkpointFiles(name: string): PlannedFile[] {
	const symbol = toCamelCase(name) + 'CheckpointConfig';
	return [
		{
			path: 'src/configs/' + symbol + '.ts',
			contents: `import type { Checkpoint } from '../lib/game/models/Game.types';\n\nexport const ${symbol}: Checkpoint = {\n\tid: '${toKebabCase(name)}',\n\ttitle: '${toPascalCase(name)}',\n\tdescription: '',\n\tx: 0,\n\ty: 0,\n\trequires: [],\n\tconditions: [],\n\tactions: []\n};\n`
		}
	];
}
