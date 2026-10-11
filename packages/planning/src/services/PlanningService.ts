import { planRegistry } from '../utils/planRegistry';
import { attest, findIdentity, planFiles } from '../utils/planIdentity';
import type { PlanningApi, CreatePlanInput } from '../models/PlanningBridge.types';
import type { ProjectSnapshot, PlanningErrorCode } from '../models/PlanningView.types';
import type { PlanSummary } from '../models/Planning.types';
import type { Git } from '../utils/planGit';
import { paths, revision, blob } from '../utils/planGit';
import { fail, hash, json, now, planData, parse } from '../utils/planData';
import { author, contractHash, planValidate, text } from '../utils/planValidate';
import { clean, commitFiles, planWrite } from '../utils/planWrite';
import { planRead } from '../utils/planRead';
import { planDesign, approve, readImage } from '../utils/planDesign';
import { planThread, append } from '../utils/planThread';
import { commits, planHistory, revisionInfo } from '../utils/planHistory';
async function create(git: Git, input: CreatePlanInput) {
	const unitId = input.unitId ?? `${input.category}.${input.slug}`;
	const path = planValidate(`${input.category}.${input.slug}`);
	text(input.title);
	text(input.goal);
	author(input.author);
	contractHash(input.contract);
	await clean(git, path);
	const baseRevision = await revision(git);
	if (input.unitId !== undefined)
		await attest(git, baseRevision, { unitId, category: input.category });
	if (await findIdentity(git, baseRevision, unitId)) fail('already-exists', 'Plan already exists');
	if ((await paths(git, baseRevision, `${path}/plan.json`)).length)
		fail('already-exists', 'Plan already exists');
	const value = {
		unitId,
		category: input.category,
		slug: input.slug,
		title: input.title,
		goal: input.goal,
		createdAt: now(),
		createdBy: input.author,
		baseRevision,
		path,
		contract: input.contract,
		contractHash: hash(planData(input.contract))
	};
	const committed = await commitFiles(
		git,
		{ ...(await planRegistry(git, baseRevision)), [`${path}/plan.json`]: json(value) },
		`feat: plan ${unitId}`
	);
	return { ...committed, value: await planRead(git, committed.commit, unitId) };
}
async function snapshot(git: Git, requested?: string): Promise<ProjectSnapshot> {
	const revision = await revisionInfo(git, requested);
	const result: ProjectSnapshot = { revision, plans: [], rejected: [] };
	for (const path of await planFiles(git, revision.commit)) {
		let unitId: string | null = null;
		try {
			unitId = parse<PlanSummary>(await blob(git, revision.commit, path)).unitId;
			result.plans.push(await planRead(git, revision.commit, unitId));
		} catch (error) {
			result.rejected.push({
				path,
				unitId,
				code: (error as { code?: PlanningErrorCode }).code ?? 'artifact-corrupt',
				message: (error as Error).message
			});
		}
	}

	return result;
}
async function branches(git: Git) {
	const current = (await revisionInfo(git)).branch;
	return (
		await git.run([
			'for-each-ref',
			'--format=%(refname:short)%00%(objectname)%00%(committerdate:iso-strict)%00%(subject)',
			'refs/heads'
		])
	)
		.toString()
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [name, tip, date, subject] = line.split('\0');
			return {
				name,
				tip,
				current: name === current,
				committedAt: new Date(date).toISOString(),
				subject
			};
		});
}
function write<T, R>(git: Git, input: T, action: (value: T) => Promise<R>): Promise<R> {
	const copied = globalThis.structuredClone(input);
	return planWrite(git, () => action(copied));
}
export function planningService(git: Git): PlanningApi {
	return {
		snapshot: (input) => snapshot(git, input?.revision),
		listPlans: async (input) => (await snapshot(git, input?.revision)).plans,
		readPlan: async (input) => planRead(git, await revision(git, input.revision), input.unitId),
		listBranches: () => branches(git),
		listCommits: async (input) => commits(git, await revision(git, input?.revision), input?.limit),
		createPlan: (input) => write(git, input, (value) => create(git, value)),
		addDesign: (input) => write(git, input, (value) => planDesign(git, value)),
		openThread: (input) => write(git, input, (value) => planThread(git, value)),
		appendMessage: (input) => write(git, input, (value) => append(git, value)),
		approveDesign: (input) => write(git, input, (value) => approve(git, value)),
		readImage: (input) => readImage(git, input),
		entityHistory: (input) => planHistory(git, input)
	};
}
