// @harness-uid u_e6w2kdpv7l
const annotation = /@harness-uid\s+(u_[a-z2-7]{10})(?![a-z2-7])/;
const head = 1000;
/** Files copied byte for byte into generated projects: a copy must not share the uid of its original. */
const embedded = new Set([
	'packages/game/src/models/game-authoring/Game.types.ts',
	'packages/game/src/validators/game-authoring/LevelValidator.ts',
	'packages/game/src/validators/game-authoring/gameDocument.ts',
	'packages/game/src/validators/game-authoring/gameDocument.types.ts',
	'packages/game/src/utils/game-authoring/gameStep.ts',
	'packages/game/src/utils/game-authoring/keyDoor.ts',
	'packages/game/src/utils/game-authoring/checkpointGraph.ts',
	'packages/game/src/adapters/game-authoring/Canvas2dAdapter.ts',
	'packages/game/src/adapters/game-authoring/ThreeSceneAdapter.ts',
	'packages/game/src/adapters/game-authoring/Software3dAdapter.ts',
	'packages/game/src/adapters/game-authoring/Software3dAdapter.types.ts',
	'packages/game/src/adapters/agents-providers/DecartStreamAdapter.ts',
	'packages/game/src/adapters/agents-providers/DecartStreamAdapter.types.ts',
	'src/templates/development-tooling/atomicPreprocess.js',
	'src/templates/development-tooling/atomicSyntax.js',
	'src/templates/development-tooling/htmlElements.js'
]);
/** Native element atoms are compared with their canonical source, comment for comment. */
const canonicalAtom = /\/atoms\/(?:Html|Svg)[A-Za-z0-9]*\.svelte$/;

/** @pure The uid a file announces in its first lines, if any. */
export function readUid(code: string): string | undefined {
	return annotation.exec(code.slice(0, head))?.[1];
}

/** @pure The comment line that carries a uid in this kind of file; none when it takes no comment, as a canonical native atom takes none. */
export function uidComment(path: string, uid: string): string | undefined {
	if (canonicalAtom.test(path) || embedded.has(path)) return undefined;
	if (/\.svelte$/.test(path)) return `<!-- @harness-uid ${uid} -->`;
	if (/\.(?:[cm]?[jt]sx?)$/.test(path)) return `// @harness-uid ${uid}`;
	if (/\.css$/.test(path)) return `/* @harness-uid ${uid} */`;
	return undefined;
}

/**
 * @pure The source with the uid line added, after a shebang or the leading harness comments of a
 * component. A file that already announces a uid, or takes no comment, is returned as it is.
 */
export function withUid(path: string, code: string, uid: string): string {
	const comment = uidComment(path, uid);
	if (!comment || readUid(code)) return code;
	const lines = code.split('\n');
	let at = lines[0]?.startsWith('#!') ? 1 : 0;
	if (path.endsWith('.svelte')) while (lines[at]?.startsWith('<!-- @harness-')) at += 1;
	lines.splice(at, 0, comment);
	return lines.join('\n');
}

export { readUid as unitUid };
