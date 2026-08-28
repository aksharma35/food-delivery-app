import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const hasLangfuseKeys = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

// Exported so route handlers can force a flush before a serverless function
// instance is frozen — spans are otherwise not guaranteed to be exported in
// time. Undefined when Langfuse isn't configured, so tracing calls elsewhere
// become no-ops instead of failing.
export const langfuseSpanProcessor = hasLangfuseKeys
  ? new LangfuseSpanProcessor({ exportMode: "immediate" })
  : undefined;

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!langfuseSpanProcessor) {
    console.warn(
      "Langfuse tracing disabled: LANGFUSE_PUBLIC_KEY and/or LANGFUSE_SECRET_KEY are not set.",
    );
    return;
  }

  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });
  tracerProvider.register();
}
