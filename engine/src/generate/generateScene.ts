import { buildContext } from "../context/buildContext.js";
import { validateScene } from "../validate/canonCheck.js";
import { getClient, getModel } from "./client.js";
import { buildSystemPrompt, buildUserPrompt } from "./promptTemplates.js";
import type { GeneratedScene, SceneRequest } from "../types/index.js";

export interface GenerateSceneOptions {
  /** Kalau true, tidak memanggil API — cuma print context+prompt yang akan dikirim. */
  dryRun?: boolean;
}

export async function generateScene(
  request: SceneRequest,
  options: GenerateSceneOptions = {}
): Promise<GeneratedScene | { dryRun: true; systemPrompt: string; userPrompt: string }> {
  const bibleContext = await buildContext(request);
  const systemPrompt = buildSystemPrompt(bibleContext);
  const userPrompt = buildUserPrompt(request);

  if (options.dryRun) {
    return { dryRun: true, systemPrompt, userPrompt };
  }

  const model = getModel();
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  const validation = validateScene(rawText, request);

  return {
    request,
    rawText,
    validation,
    meta: {
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}
