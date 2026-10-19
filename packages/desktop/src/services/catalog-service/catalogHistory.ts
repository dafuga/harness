import type { ComponentManifest } from "../../../../../src/lib/contracts";
import { gitRead } from "../../utils/gitRead";

export async function catalogHistory(root: string, revision: string, unit: ComponentManifest) {
	const paths = [...unit.owns.source, ...(unit.documentation ? [unit.documentation] : [])];
	if (!paths.length) return [];
	const raw = await gitRead(root, [
		'log',
		'-100',
		'--format=%H%x00%aI%x00%s',
		revision,
		'--',
		...paths
	]);
	return raw
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [commit, at, title] = line.split('\0');
			return {
				id: commit,
				at,
				kind: 'commit' as const,
				title,
				detail: 'Source changed. Verification is recorded separately.',
				commit,
				version: null
			};
		});
}
