import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-xxxx")) {
    throw new Error(
      "ANTHROPIC_API_KEY belum diset. Salin engine/.env.example ke engine/.env " +
        "dan isi dengan API key asli Anda."
    );
  }

  client = new Anthropic({ apiKey });
  return client;
}

export function getModel(): string {
  return process.env.GENERATION_MODEL ?? "claude-sonnet-5";
}
