import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const hasLangfuseKeys = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

console.log(
  `[instrumentation] module loaded — hasLangfuseKeys=${hasLangfuseKeys}, NEXT_RUNTIME=${process.env.NEXT_RUNTIME}`,
);

// Exported so route handlers can force a flush before a serverless function
// instance is frozen — spans are otherwise not guaranteed to be exported in
// time. Undefined when Langfuse isn't configured, so tracing calls elsewhere
// become no-ops instead of failing.
export const langfuseSpanProcessor = hasLangfuseKeys
  ? new LangfuseSpanProcessor({ exportMode: "immediate" })
  : undefined;

export function register() {
  console.log(`[instrumentation] register() called, NEXT_RUNTIME=${process.env.NEXT_RUNTIME}`);

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.log("[instrumentation] skipping — not the nodejs runtime");
    return;
  }

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
  console.log("[instrumentation] Langfuse tracer provider registered.");
}
