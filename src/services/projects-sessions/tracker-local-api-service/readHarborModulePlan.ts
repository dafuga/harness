// @harness-uid u_g7kdpz7bel
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { projectModulePlanSchema } from '../../../helpers/projects-sessions/projectModuleProgress';
import type {
	ProjectModule,
	ProjectModulePlan
} from '../../../helpers/projects-sessions/projectModuleProgress.types';

const document = 'refs/remotes/origin/main:specifications/project-module-plan.md';

export async function readHarborModulePlan(root: string): Promise<ProjectModulePlan> {
	const git = new GitAdapter(root);
	const text = await git.attempt(['show', document]).catch(() => undefined);
	if (!text || !/^\*\*Status: Approved\*\*$/m.test(text)) return { state: 'review' };
	const modules = text
		.split('\n')
		.filter((line) => /^\| [a-z0-9][a-z0-9-]* \| /.test(line))
		.map(parseModule);
	const parsed = projectModulePlanSchema.safeParse({ state: 'available', modules });
	return parsed.success && modules.some((row) => row?.release === 'first')
		? parsed.data
		: { state: 'unavailable' };
}

function parseModule(line: string): ProjectModule | undefined {
	const [, id, title, release, status, , , receipt] = line.split('|').map((cell) => cell.trim());
	if (release !== 'First release' && release !== 'Later') return undefined;
	const includesProof = /\bmerge=[a-f0-9]{40} proof=https:\/\/\S+/.test(receipt ?? '');
	const includesLive = /\blive=https:\/\/\S+/.test(receipt ?? '');
	const states = {
		Planned: 'planned',
		'In progress': 'in_progress',
		Built: includesProof ? 'built' : undefined,
		Live: includesProof && includesLive ? 'live' : undefined
	} as const;
	const state = states[status as keyof typeof states];
	if (!state) return undefined;
	return { id, title, release: release === 'First release' ? 'first' : 'later', state };
}
