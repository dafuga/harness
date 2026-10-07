import { ReportCommandService } from '../services/ReportCommandService';
export class ReportCommand {
	run(argv: string[]) {
		return new ReportCommandService().execute(argv);
	}
}
