import type { ResourceMonitorService } from '../../src/services/execution-runtimes/resource-queue-service/ResourceMonitorService';

export type Queue = ConstructorParameters<typeof ResourceMonitorService>[0]['queue'];
