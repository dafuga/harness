import { builtInTemplates } from './builtInLoopTemplates';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../core/errors';
import {
	validateLoopId,
	validateRequiredText,
	isMissingFile,
	type LoopEvaluator
} from './loopState';

export interface LoopTemplateStep {
	id: string;
	title: string;
}

export interface LoopTemplate {
	id: string;
	title: string;
	summary: string;
	extends?: string;
	steps: LoopTemplateStep[];
	evaluators?: LoopEvaluator[];
	source?: 'built-in' | 'project';
}

export interface ResolvedLoopTemplate {
	id: string;
	title: string;
	summary: string;
	lineage: string[];
	steps: LoopTemplateStep[];
	evaluators: LoopEvaluator[];
}

export async function listLoopTemplates(root: string): Promise<LoopTemplate[]> {
	return [...builtInTemplates, ...(await readProjectTemplates(root))].map((template) => ({
		...template,
		source: template.source ?? 'built-in'
	}));
}

export async function resolveLoopTemplate(root: string, id: string): Promise<ResolvedLoopTemplate> {
	const templates = new Map(
		(await listLoopTemplates(root)).map((template) => [template.id, template])
	);
	return resolveTemplate(templates, validateLoopId(id, 'Loop template'), []);
}

function resolveTemplate(
	templates: Map<string, LoopTemplate>,
	id: string,
	chain: string[]
): ResolvedLoopTemplate {
	const template = templates.get(id);
	if (!template) fail(`Loop template "${id}" does not exist.`);
	if (chain.includes(id)) fail(`Loop template inheritance cycle: ${[...chain, id].join(' -> ')}`);
	const parent = template.extends
		? resolveTemplate(templates, validateLoopId(template.extends, 'Parent loop template'), [
				...chain,
				id
			])
		: emptyTemplate();

	return {
		id: template.id,
		title: template.title,
		summary: template.summary,
		lineage: [...parent.lineage, template.id],
		steps: mergeById(parent.steps, template.steps),
		evaluators: mergeById(parent.evaluators, template.evaluators ?? [])
	};
}

function emptyTemplate(): ResolvedLoopTemplate {
	return { id: '', title: '', summary: '', lineage: [], steps: [], evaluators: [] };
}

function mergeById<T extends { id: string }>(parent: T[], child: T[]): T[] {
	const merged = [...parent];
	for (const item of child) {
		const index = merged.findIndex((candidate) => candidate.id === item.id);
		if (index >= 0) merged[index] = item;
		else merged.push(item);
	}
	return merged;
}

async function readProjectTemplates(root: string): Promise<LoopTemplate[]> {
	const dir = join(root, 'specification', 'loop-templates');
	try {
		const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
		const templates = await Promise.all(names.map((name) => readProjectTemplate(dir, name)));
		return templates;
	} catch (error) {
		if (isMissingFile(error)) return [];
		throw error;
	}
}

async function readProjectTemplate(dir: string, name: string): Promise<LoopTemplate> {
	const raw = JSON.parse(await readFile(join(dir, name), 'utf8')) as Partial<LoopTemplate>;
	const id = validateLoopId(raw.id ?? name.replace(/\.json$/, ''), 'Loop template');
	return {
		id,
		title: validateRequiredText(raw.title ?? id, 'Loop template title'),
		summary: validateRequiredText(raw.summary ?? 'Project loop template.', 'Loop template summary'),
		extends: raw.extends,
		steps: normalizeSteps(raw.steps ?? []),
		evaluators: normalizeEvaluators(raw.evaluators ?? []),
		source: 'project'
	};
}

function normalizeSteps(steps: LoopTemplateStep[]): LoopTemplateStep[] {
	return steps.map((step) => ({
		id: validateLoopId(step.id, 'Loop template step'),
		title: validateRequiredText(step.title, 'Loop template step title')
	}));
}

function normalizeEvaluators(evaluators: LoopEvaluator[]): LoopEvaluator[] {
	return evaluators.map((evaluator) => ({
		id: validateLoopId(evaluator.id, 'Loop evaluator'),
		title: validateRequiredText(evaluator.title, 'Loop evaluator title'),
		command: validateRequiredText(evaluator.command, 'Loop evaluator command'),
		step: evaluator.step ? validateLoopId(evaluator.step, 'Loop evaluator step') : undefined
	}));
}
