// @harness-uid u_t5m7azkv7c
export interface CliOptions {
	operation: string;
	flags: Record<string, string | boolean>;
	positionals: string[];
}

export {
	reportCli,
	inputData,
	required
} from '../../services/reports-media/report-command-service/reportCli';
