// @harness-uid u_wwerrde2nk
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { SourceRange } from './scanCandidates.types';

const codeExtension =
	/\.(?:[cm]?[jt]sx?|svelte|vue|astro|html?|css|scss|less|py|rb|go|rs|swift|kt|java|cs|c|cc|cpp|h|hpp|php|sql|sh|bash|fish|exs?|lua|dart|scala|clj|hs|zig|pl|r|gql|graphql)$/i;
const generated =
	/(?:^|\/)(?:node_modules|vendor|dist|\.cache|\.git)(?:\/|$)|\.(?:min\.js|generated\.[^/]+)$/;

export async function committedSourcePaths(
	root: string,
	revision: string,
	ranges?: Map<string, SourceRange[]>,
	signal?: AbortSignal
) {
	const output = await new GitAdapter(root).bytes(['ls-tree', '-rlz', '--full-tree', revision], {
		signal
	});
	return output
		.toString('utf8')
		.split('\0')
		.flatMap((row) => {
			const match = /^100(?:644|755) blob [a-f0-9]+ +([0-9]+)\t(.+)$/s.exec(row);
			if (!match) return [];
			const [, bytes, path] = match;
			if (!codeExtension.test(path) || generated.test(path) || (ranges && !ranges.has(path)))
				return [];
			return [{ path, bytes: Number(bytes) }];
		});
}
