// @harness-uid u_ntk72qiuao
import type { readAssistantConfig } from './readAssistantConfig';

export type AssistantRunnerConfig = Awaited<ReturnType<typeof readAssistantConfig>>;
export type AssistantCanvasConfig = NonNullable<AssistantRunnerConfig['canvas']>;
export type AssistantQaConfig = NonNullable<AssistantRunnerConfig['qa']>;
