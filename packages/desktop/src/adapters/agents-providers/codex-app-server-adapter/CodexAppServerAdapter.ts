import type { ResourceQueueService } from '../../../../../../src/services/execution-runtimes/ResourceQueueService';
import type {
	AgentRunner,
	AgentTurn,
	CliCommand,
	GeneratedImage,
	ImageGenerator,
	ImageRequest
} from '../../../models/agents-providers/AgentRunner.types';
import { ImageBytesValidator } from '../../../validators/development-tooling/ImageBytesValidator';
import { codexState } from './codexState';
import { codexTurn } from './codexTurn';

export class CodexAppServerAdapter implements AgentRunner, ImageGenerator {
	constructor(
		private command: CliCommand = { command: 'codex', args: [] },
		private queue?: ResourceQueueService
	) {}
	private server(): CliCommand {
		return {
			command: this.command.command,
			args: [...this.command.args, 'app-server', '--stdio', '-c', 'model_provider="openai"']
		};
	}
	discover() {
		return codexState(this.command, this.server());
	}
	async run(turn: AgentTurn) {
		const result = await codexTurn(this.server(), turn, this.queue);
		return { text: result.text, model: result.model };
	}
	async generateImage(request: ImageRequest): Promise<GeneratedImage> {
		const result = await codexTurn(
			this.server(),
			{
				...request,
				effort: null,
				access: 'read-only',
				image: true,
				onText: () => {},
				prompt:
					'Use the image_gen tool to generate exactly ONE complete PNG image for this design. Do not use code, SVG, screenshots or descriptions as a substitute. Return the actual image generation result.\n' +
					request.prompt
			},
			this.queue
		);
		const item = result.images.find((i) => i.status === 'completed' && !i.failure && i.result);
		if (!item?.result)
			throw new Error(
				'Codex returned no completed image generation. ' +
					(result.text.slice(-600) || 'Check image-generation availability.')
			);
		const bytes = Buffer.from(item.result, 'base64');
		new ImageBytesValidator().validate(bytes);
		return { bytes, revisedPrompt: item.revisedPrompt ?? null };
	}
}
