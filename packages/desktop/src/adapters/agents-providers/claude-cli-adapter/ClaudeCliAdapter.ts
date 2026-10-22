import type {
	AgentRunner,
	AgentTurn,
	CliCommand
} from '../../../models/agents-providers/AgentRunner.types';
import { claudeState } from './claudeState';
import { claudeTurn } from './claudeTurn';

export class ClaudeCliAdapter implements AgentRunner {
	constructor(private command: CliCommand = { command: 'claude', args: [] }) {}
	discover() {
		return claudeState(this.command);
	}
	run(turn: AgentTurn) {
		return claudeTurn(this.command, turn);
	}
}
