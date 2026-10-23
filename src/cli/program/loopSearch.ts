import type { SearchLoopsInput, LoopSearchResult } from './loopSearch.types';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
	isMissingFile,
	loopPaths,
	readLoop
} from '../../workflows/development-tooling/loop-state/loopState';
import { listLoopTemplates } from '../../workflows/development-tooling/loop-templates/loopTemplates';

export async function searchLoops(input: SearchLoopsInput = {}): Promise<LoopSearchResult[]> {
	const root = input.root ?? process.cwd();
	const query = input.query?.trim().toLowerCase();
	const results = [...(await templateResults(root)), ...(await loopResults(root))];
	return query ? results.filter((result) => matches(result, query)) : results;
}

export function renderLoopSearchResults(results: LoopSearchResult[]): string {
	if (results.length === 0) return 'No loop templates or loop instances matched.';
	return results
		.map((result) => `${result.kind}: ${result.id}\n  ${result.title}\n  ${result.summary}`)
		.join('\n\n');
}

async function templateResults(root: string): Promise<LoopSearchResult[]> {
	return (await listLoopTemplates(root)).map((template) => ({
		kind: 'template' as const,
		id: template.id,
		title: template.title,
		summary: template.summary,
		source: template.source ?? 'built-in'
	}));
}

async function loopResults(root: string): Promise<LoopSearchResult[]> {
	const dir = join(root, 'specification', 'loops');
	try {
		const names = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
		return (await Promise.all(names.map((name) => loopResult(root, name)))).filter(isResult);
	} catch (error) {
		if (isMissingFile(error)) return [];
		throw error;
	}
}

async function loopResult(root: string, name: string): Promise<LoopSearchResult | undefined> {
	try {
		const state = await readLoop(loopPaths(root, name).state);
		return {
			kind: 'loop',
			id: state.name,
			title: state.goal,
			summary: `${completedSteps(state.steps)} of ${state.steps.length} steps complete.`,
			source: 'project'
		};
	} catch (error) {
		if (isMissingFile(error)) return undefined;
		throw error;
	}
}

function completedSteps(steps: Array<{ status: string }>): number {
	return steps.filter((step) => step.status === 'complete').length;
}

function isResult(result: LoopSearchResult | undefined): result is LoopSearchResult {
	return result !== undefined;
}

function matches(result: LoopSearchResult, query: string): boolean {
	return [result.kind, result.id, result.title, result.summary, result.source].some((value) =>
		value.toLowerCase().includes(query)
	);
}

export type { LoopSearchKind, LoopSearchResult, SearchLoopsInput } from './loopSearch.types';
