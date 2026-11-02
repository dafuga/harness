// @harness-uid u_gko3ke6ztr
import { ReportCommandService } from '../../services/reports-media/report-command-service/ReportCommandService';
export class ReportCommand {
	run(argv: string[]) {
		return new ReportCommandService().execute(argv);
	}
}
