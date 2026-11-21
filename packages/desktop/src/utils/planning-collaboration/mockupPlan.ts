import { z } from 'zod';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import { RunCancelled } from '../../models/agents-providers/AgentRunner.types';
import { gitRead, gitText } from '../projects-sessions/gitRead';
import { sourceSnapshot } from '../verification-evidence/sourceSnapshot';
import { sourceChanges } from '../git-source-history/sourceChanges';
import { mockupModels } from '../explorer-ui/composeModes';
import { designCount } from './designCount';
import { designDirections } from './plan-design/designDirections';
import {
	answerSchema,
	mockupMarker,
	mockupSource,
	sourceSchema,
	variationSchema
} from './mockupSource';
import { mockupMatrix } from './mockupMatrix';
import type { MockupAnswer, MockupSource, MockupVariation } from './mockupSource.types';

const { author: sonnet, variations: haiku } = mockupModels;
export const defaultWidths = [390, 834, 1440, 1920];
export { visualCategory as visualPlan } from '../explorer-ui/composeModes';

function displayRequest(text: string) {
	return (
		/\b(?:re[ -]?render|recapture)\b/i.test(text) ||
		/\b(?:add|show|preview|render|include|capture)\b[^.\n]{0,155}\b(?:\d{3,4}\s*(?:px\b|pixels?\b|wide\b)|widths?\b|viewports?\b|states?\b|light mode\b|dark mode\b)/i.test(
			text
		)
	);
}

function displayOnly(text: string) {
	return (
		displayRequest(text) &&
		/^\s*(?:please\s+)?(?:can you\s+)?(?:also\s+)?(?:add|show|preview|render|include|capture|re[ -]?render|recapture)\b/i.test(
			text
		) &&
		!/\b(?:redesign|move|rearrange|replace|rename|implement|remove)\b/i.test(text)
	);
}

function authorPrompt(context: RunContext, proposal: string): string {
	const before = context.entity.planned
		? 'null because the entity is new'
		: 'a {html,css} snapshot reconstructed faithfully from the current implementation';
	return [
		proposal,
		'Plan only. Read the assigned entity and its real project components, styles and tokens. Do not write files.',
		'Build static responsive HTML/CSS snapshots using the existing component structure and design tokens.',
		'Use representative fixture data. Keep credentials, private data and environment files out of the mockup.',
		'Use native HTML for the rendered representation of actual project components. Reuse their styles and markup.',
		'Respond with JSON only: {sources: [repo-relative paths read], stylesheets: [repo-relative CSS paths to inline in order], before, options: [{direction,html,css}]}.',
		'Each html field contains only a body fragment. Include no scripts, iframes, navigation, remote resources or full documents.',
		'Inline any required graphic or font using project-owned assets. Use the project theme and responsive styles.',
		'Before must be ' + before + '.',
		'Each option must render at 390, 834, 1440 and 1920px.',
		'Design option count: ' + designCount(context.request),
		'Write each direction as a short sentence. Directions:',
		...designDirections(designCount(context.request))
	].join('\n');
}

async function projectCss(context: RunContext, answer: MockupAnswer) {
	const { root, revision } = context;
	const tracked = new Set(
		(await gitRead(root, ['ls-tree', '-rz', '--name-only', revision.commit])).split('\0')
	);
	const paths = [...answer.sources, ...answer.stylesheets];
	if (
		paths.some((path) => !tracked.has(path) || path.split('/').some((part) => part.startsWith('.')))
	)
		throw new Error('The mockup cites source outside the selected project revision.');
	if (
		!context.entity.planned &&
		!answer.sources.some((path) => context.entity.sources.includes(path))
	)
		throw new Error('The mockup must cite source belonging to the existing entity.');
	if (answer.stylesheets.some((file) => !file.endsWith('.css')))
		throw new Error('A mockup stylesheet must be a project CSS file.');
	return (
		await Promise.all(answer.stylesheets.map((file) => gitText(root, revision.commit, file)))
	).join('\n');
}

async function ask(context: RunContext, model: string, prompt: string, schema: z.ZodType) {
	const { signal, root, id, emit, mockupRunner } = context;
	if (signal.aborted) throw new RunCancelled();
	if (!mockupRunner) throw new Error('Claude CLI is required for visual Plans.');
	emit({
		runId: id,
		kind: 'status',
		phase: 'generating',
		detail: 'Preparing HTML mockups with ' + model
	});
	const before = await sourceSnapshot(root);
	const result = await mockupRunner.run({
		model,
		cwd: root,
		prompt,
		outputSchema: JSON.stringify(z.toJSONSchema(schema, { target: 'draft-7' })),
		effort: null,
		access: 'read-only',
		signal,
		onText: () => {},
		onStatus: () => {}
	});
	if (signal.aborted) throw new RunCancelled();
	if (sourceChanges(before, await sourceSnapshot(root)).length)
		throw new Error('The Plan agent changed project files. The changes remain recoverable.');
	return JSON.parse(
		result.text.trim().replace(/^```(?:json)?\s*([\s\S]+?)\s*```$/i, '$1')
	) as unknown;
}

async function authored(context: RunContext, prompt: string): Promise<MockupSource> {
	const answer = answerSchema.parse(await ask(context, sonnet, prompt, answerSchema));
	if (answer.options.length !== designCount(context.request))
		throw new Error('Sonnet did not return the requested number of mockup options.');
	if (Boolean(answer.before) === context.entity.planned)
		throw new Error('The mockup does not describe the current implementation correctly.');
	return sourceSchema.parse({
		...answer,
		projectCss: await projectCss(context, answer),
		widths: defaultWidths,
		states: [],
		author: sonnet,
		enhancer: null
	});
}

function mergeVariations(source: MockupSource, extra: MockupVariation): MockupSource {
	const { before, options } = source;
	if (
		extra.states.some(
			(state) =>
				state.options.length !== options.length || Boolean(state.before) !== Boolean(before)
		)
	)
		throw new Error('Haiku must render every existing option and its corresponding before state.');
	const states = new Map(source.states.map((state) => [state.id, state]));
	for (const state of extra.states) {
		if (states.has(state.id)) throw new Error('Haiku must preserve existing mockup states.');
		states.set(state.id, state);
	}
	const widths = [...new Set([...source.widths, ...extra.widths])].sort((a, b) => a - b);
	return sourceSchema.parse({ ...source, widths, states: [...states.values()], enhancer: haiku });
}

async function expanded(context: RunContext, source: MockupSource) {
	const prompt = [
		'Add only the requested viewport widths or visual states to the static HTML mockup.',
		'Keep all existing options, widths, and states. For a rerender, return empty arrays.',
		'Return JSON only: {widths:[number],states:[{id,before,options}]} with only new states/widths.',
		'Each new state has a lowercase kebab-case id, a before {html,css} or null as in the saved design, and one {html,css} per option in existing order.',
		'Retain existing project components and tokens. Do not write files. Use dark or light as the state id for theme requests.',
		'Request: ' + context.request.text,
		'Saved mockup: ' + JSON.stringify(source)
	].join('\n');
	const extra = variationSchema.parse(await ask(context, haiku, prompt, variationSchema));
	return mergeVariations(source, extra);
}

export async function mockupPlan(context: RunContext, proposal: string) {
	const anchor = context.entity.threads.find((thread) => thread.id === context.request.threadId);
	const latest = context.entity.latestVersion;
	const chosen = displayOnly(context.request.text) ? latest : (anchor?.version ?? latest);
	const prior = mockupSource(
		context.entity.versions.find((version) => version.version === chosen)?.notes
	);
	const followup = prior && displayOnly(context.request.text);
	const initial = authorPrompt(context, proposal);
	const prompt =
		!followup && prior
			? initial +
				'\nEarlier mockup: ' +
				JSON.stringify({ source: prior, region: anchor?.region, option: anchor?.option })
			: initial;
	let source = followup ? prior : await authored(context, prompt);
	if (followup || displayRequest(context.request.text)) source = await expanded(context, source);
	const notes = mockupMarker + JSON.stringify(source);
	if (notes.length > 1000000)
		throw new Error('The mockup source exceeds the design version size limit.');
	const options = await mockupMatrix(context, source, followup ? context.request.text : prompt);
	return {
		notes,
		options,
		prompt: followup ? context.request.text : prompt,
		generator: { provider: 'claude' as const, model: source.author }
	};
}
