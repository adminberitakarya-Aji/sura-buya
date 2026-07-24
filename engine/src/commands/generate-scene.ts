import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateScene } from "../generate/generateScene.js";
import { explainContext } from "../context/buildContext.js";
import type { CharacterId, SceneRequest } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../../output");

/**
 * Contoh pemakaian:
 *   pnpm generate-scene -- --characters=suro,buya --region=Bali --premise="Suro terburu-buru masuk area upacara tanpa tahu aturannya"
 *   pnpm generate-scene -- --dry-run --characters=suro,buya --premise="test context"
 */

function parseArgs(argv: string[]): {
  characters: CharacterId[];
  region?: string;
  premise: string;
  targetLines?: number;
  dryRun: boolean;
} {
  const args = Object.fromEntries(
    argv
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [key, ...rest] = a.replace(/^--/, "").split("=");
        return [key, rest.join("=")];
      })
  );

  const characters = (args.characters ?? "suro,buya")
    .split(",")
    .map((c) => c.trim().toLowerCase()) as CharacterId[];

  return {
    characters,
    region: args.region,
    premise: args.premise ?? "Suro dan Buya tiba di daerah baru dan bertemu teman baru.",
    targetLines: args.lines ? Number(args.lines) : undefined,
    dryRun: "dry-run" in args,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  const request: SceneRequest = {
    characters: parsed.characters,
    region: parsed.region,
    premise: parsed.premise,
    targetLines: parsed.targetLines,
  };

  console.log("=== Scene Request ===");
  console.log(request);
  console.log("\n=== Bible files yang akan dipakai ===");
  console.log(explainContext(request));

  const result = await generateScene(request, { dryRun: parsed.dryRun });

  if ("dryRun" in result) {
    console.log("\n=== DRY RUN: System Prompt ===\n");
    console.log(result.systemPrompt);
    console.log("\n=== DRY RUN: User Prompt ===\n");
    console.log(result.userPrompt);
    console.log(
      "\n(Tidak ada API call yang dilakukan. Hapus --dry-run untuk generate sungguhan.)"
    );
    return;
  }

  console.log("\n=== Generated Scene ===\n");
  console.log(result.rawText);

  console.log("\n=== Validation ===");
  console.log(`Status: ${result.validation.passed ? "✅ PASSED" : "❌ FAILED"}`);
  for (const issue of result.validation.issues) {
    const icon = issue.severity === "error" ? "🛑" : "⚠️";
    console.log(`${icon} [${issue.rule}] ${issue.message}`);
  }

  const timestamp = result.meta.generatedAt.replace(/[:.]/g, "-");
  const outPath = path.join(OUTPUT_DIR, `scene-${timestamp}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\nHasil disimpan ke: ${outPath}`);

  if (!result.validation.passed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Generate scene gagal:", err.message ?? err);
  process.exitCode = 1;
});
