import { plugin } from 'bun';
import { SourceProfileAdapter } from './SourceProfileAdapter';
import { profileSelection } from './runnerSelection';

const root = process.env.HARNESS_RUNTIME_PROFILE_ROOT;
const selected = root ? profileSelection(root) : null;
if (selected) {
	const adapter = new SourceProfileAdapter(selected);
	const prefix = selected.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const filter = new RegExp(`^${prefix}/(?!.*node_modules/).*\\.(?:[cm]?[jt]s|[jt]sx)$`);
	plugin({
		name: 'harness-source-profiles',
		setup(build) {
			build.onLoad({ filter }, async ({ path }) => {
				const source = await Bun.file(path).text();
				const code = adapter.transform(source, path);
				const transpiler = new Bun.Transpiler({ loader: loader(path) });
				return { contents: transpiler.transformSync(code ?? source), loader: 'js' };
			});
		}
	});
}

function loader(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
	if (path.endsWith('.tsx')) return 'tsx';
	if (path.endsWith('.jsx')) return 'jsx';
	return path.endsWith('ts') ? 'ts' : 'js';
}
