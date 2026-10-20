import type { PlannedFile } from '../core/files';
import { toKebabCase, toCamelCase, toPascalCase } from '../core/case';

export function gameViewFiles(name: string): PlannedFile[] {
	const symbol = toCamelCase(name) + 'ViewConfig';
	return [
		{
			path: 'src/config/' + symbol + '.ts',
			contents: `import type { GameView } from '../lib/game/models/Game.types';\n\nexport const ${symbol}: GameView = {\n\tid: '${toKebabCase(name)}',\n\ttitle: '${toPascalCase(name)}',\n\tdimension: '2d',\n\tstyle: '',\n\tcheckpoints: []\n};\n`
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
			path: 'src/config/' + symbol + '.ts',
			contents: `import type { Checkpoint } from '../lib/game/models/Game.types';\n\nexport const ${symbol}: Checkpoint = {\n\tid: '${toKebabCase(name)}',\n\ttitle: '${toPascalCase(name)}',\n\tdescription: '',\n\tx: 0,\n\ty: 0,\n\trequires: [],\n\tconditions: [],\n\tactions: []\n};\n`
		}
	];
}
