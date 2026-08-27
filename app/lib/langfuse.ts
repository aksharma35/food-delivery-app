import { Langfuse } from "langfuse";

let client: Langfuse | undefined;

/**
 * Returns a shared Langfuse client, or null when tracing isn't configured.
 * Keeping this optional means the chat route still works with no Langfuse
 * account set up — it just runs unobserved.
 */
export function getLangfuseClient(): Langfuse | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    console.warn(
      "Langfuse tracing disabled: LANGFUSE_PUBLIC_KEY and/or LANGFUSE_SECRET_KEY are not set.",
    );
    return null;
  }

  if (!client) {
    client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASEURL,
    });
  }
  return client;
}
