import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { FeaturePlanRepository } from '../../repositories/agents-providers/FeaturePlanRepository';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { FeaturePlanService } from '../../services/agents-providers/FeaturePlanService';
import { ModuleTaskServerService } from '../../services/agents-providers/ModuleTaskServerService';
import { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';
import { FeaturePlanReadinessAdapter } from '../../adapters/agents-providers/FeaturePlanReadinessAdapter';
import {
	featurePlanImage,
	registerFeaturePlanImage
} from '../../utils/agents-providers/featurePlanImage';
import {
	featurePlanImpact,
	registerFeaturePlanImpact
} from '../../utils/agents-providers/featurePlanImpact';
import { startFeaturePlan } from './feature-plan-command/startFeaturePlan';

function defaultDependencies() {
	const root = process.cwd();
	const repository = new FeaturePlanRepository(root);
	const readiness = new FeaturePlanReadinessAdapter(root);
	const service = new FeaturePlanService({
		repository,
		validator: new FeaturePlanValidator(),
		verifyReady: (plan) => readiness.verify(plan)
	});
	return { repository, service };
}

function moduleLines(plan: FeaturePlan) {
	const lines: string[] = [];
	const visited = new Set<string>();
	function append(unit: FeaturePlan['changes'][number], depth: number) {
		if (visited.has(unit.unit)) return;
		visited.add(unit.unit);
		const indent = '  '.repeat(depth);
		lines.push(
			`${indent}${unit.unit} (${unit.kind})${unit.parent ? ` parent: ${unit.parent}` : ''}`
		);
		if (unit.wantedContract)
			lines.push(`${indent}  Wanted contract: ${JSON.stringify(unit.wantedContract)}`);
		for (const child of plan.changes.filter((item) => item.parent === unit.unit))
			append(child, depth + 1);
	}
	for (const unit of plan.changes.filter((item) => !item.parent)) append(unit, 0);
	for (const unit of plan.changes) append(unit, 0);
	return lines;
}

function renderPlan(plan: FeaturePlan) {
	const lines = [
		`${plan.feature} revision ${plan.revision}`,
		plan.goal,
		plan.tldr,
		`Source: ${plan.sourceCommit}`,
		`Digest: ${plan.digest}`,
		'Design options:'
	];
	for (const page of plan.pages) {
		lines.push(`  ${page.module}`);
		for (const option of page.options) lines.push(designOptionLine(page, option));
	}
	lines.push('Modules and wanted contracts:', ...moduleLines(plan), 'Tasks:');
	for (const task of plan.tasks) {
		lines.push(
			`  ${task.id}: ${task.title} [${task.module}] depends on: ${(task.dependsOn ?? []).join(', ') || 'none'}`
		);
		if (task.wantedContract)
			lines.push(`    Wanted contract: ${JSON.stringify(task.wantedContract)}`);
	}
	lines.push(
		plan.approval
			? `Approved by ${plan.approval.reviewer} at ${plan.approval.approvedAt} (${plan.approval.digest})`
			: 'Not approved'
	);
	return lines.join('\n');
}

function designOptionLine(
	page: FeaturePlan['pages'][number],
	option: FeaturePlan['pages'][number]['options'][number]
) {
	const flags = [
		option.preferred ? 'preferred' : '',
		page.selected === option.id ? 'selected' : ''
	].filter(Boolean);
	return `    ${option.id}${flags.length ? ` (${flags.join(', ')})` : ''} ${option.version} ${option.path}`;
}

function printPlan(plan: FeaturePlan, json = false, output = console.log) {
	output(json ? JSON.stringify(plan, null, 2) : renderPlan(plan));
}
const readPlanInput = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

export class FeaturePlanCommand {
	constructor(
		private readonly dependencies: {
			service: Pick<FeaturePlanService, 'draft' | 'select' | 'approve'>;
			repository: Pick<FeaturePlanRepository, 'read'>;
			server?: Pick<ModuleTaskServerService, 'submitApproved'> &
				Partial<Pick<ModuleTaskServerService, 'runApproved'>>;
			output?: (text: string) => void;
			readInput?: (file: string) => Promise<unknown>;
			image?: typeof featurePlanImage;
		} = defaultDependencies()
	) {}

	run(): string {
		return 'feature-plan';
	}

	register(task: Command): void {
		const plan = task.command('plan').description('Review and approve feature plans');
		const read = this.dependencies.readInput ?? readPlanInput;
		const output = this.dependencies.output ?? console.log;
		plan
			.command('draft')
			.requiredOption('--input <file>')
			.option('--json')
			.action(async (options: { input: string; json?: boolean }) => {
				const input = await read(options.input);
				const draft = await this.dependencies.service.draft(
					input as Parameters<FeaturePlanService['draft']>[0]
				);
				printPlan(draft, options.json, this.dependencies.output);
			});
		plan
			.command('show <feature>')
			.option('--json')
			.action(async (feature: string, options: { json?: boolean }) => {
				const { plans } = await this.dependencies.repository.read(feature);
				const latest = plans.at(-1);
				if (!latest) throw new Error(`No feature plan found for ${feature}.`);
				printPlan(latest, options.json, this.dependencies.output);
			});
		this.registerSelection(plan);
		registerFeaturePlanImpact(plan, featurePlanImpact, read, output);
		registerFeaturePlanImage(plan, this.dependencies.image ?? featurePlanImage, output);
		this.registerApproval(plan);
		this.registerStart(plan);
	}

	private registerApproval(plan: Command) {
		plan
			.command('approve <feature>')
			.requiredOption('--digest <sha>')
			.requiredOption('--reviewer <name>')
			.option('--json')
			.action(
				async (feature: string, options: { digest: string; reviewer: string; json?: boolean }) => {
					const approved = await this.dependencies.service.approve({
						feature,
						expectedDigest: options.digest,
						reviewer: options.reviewer
					});
					const server = this.dependencies.server ?? new ModuleTaskServerService(process.cwd());
					await server.submitApproved({ feature, expectedDigest: options.digest });
					printPlan(approved, options.json, this.dependencies.output);
				}
			);
	}

	private registerStart(plan: Command) {
		plan
			.command('start <feature>')
			.requiredOption('--digest <sha>')
			.option('--worker <id>', 'Dispatch an approval-scoped worker batch.')
			.option('--parallelism <count>', 'Concurrent workers for this batch (1–8).')
			.option('--json')
			.action(
				(
					feature: string,
					options: { digest: string; worker?: string; parallelism?: string; json?: boolean }
				) =>
					startFeaturePlan(
						feature,
						options,
						this.dependencies.server ?? new ModuleTaskServerService(process.cwd()),
						this.dependencies.output ?? console.log
					)
			);
	}

	private registerSelection(plan: Command) {
		plan
			.command('select <feature>')
			.requiredOption('--page <id>')
			.requiredOption('--option <id>')
			.requiredOption('--digest <sha>')
			.option('--json')
			.action(
				async (
					feature: string,
					options: { page: string; option: string; digest: string; json?: boolean }
				) => {
					const selected = await this.dependencies.service.select({
						feature,
						page: options.page,
						option: options.option,
						expectedDigest: options.digest
					});
					printPlan(selected, options.json, this.dependencies.output);
				}
			);
	}
}
