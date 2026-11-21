// LEONIDA PROTOCOL — hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// Running this file delivers the entry: it copies the playable game (game/) and the
// maker's screenshots (screenshots/) from this repository into the output directory
// and writes the entry's dossier.json there, built with the kit's own library
// (vendor/makefun-game.ts, unchanged) under the bounty's published caps.
//
// The output directory is /output on the grader; MAKEFUN_OUTPUT_DIR stands in for
// it everywhere else. Node 22, standard library only, no network.

import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// The caps the bounty's gate (reference/gate.json) holds every dossier to.
const GATE_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1_000,
} as const;

function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
}

function deliver(): void {
  const root = repoRoot();
  const out = outputDir();
  mkdirSync(out, { recursive: true });

  // Copy the two handed-in trees fresh, so a stale file from an earlier run can
  // never leak into the entry the grader sees.
  for (const tree of ["game", "screenshots"]) {
    rmSync(join(out, tree), { recursive: true, force: true });
    cpSync(join(root, tree), join(out, tree), { recursive: true });
  }

  // The dossier is built from the copies in the output directory itself: exactly
  // the bytes the gate will rebuild and compare against.
  const dossier = buildDossier(out, GATE_CAPS);
  writeFileSync(join(out, "dossier.json"), dossier);
}

deliver();
