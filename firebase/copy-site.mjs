// 하루상점 화면 파일을 firebase/public 폴더로 복사합니다.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..");
const OUT = join(HERE, "public");

const SKIP_NAMES = new Set(["firebase", "node_modules", "now-shop"]);
const SKIP_ENDS = [".md", ".docx", ".xlsx", ".pptx", ".pdf"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

let count = 0;
for (const name of readdirSync(SITE)) {
  if (name.startsWith(".")) continue;
  if (SKIP_NAMES.has(name)) continue;
  if (SKIP_ENDS.some((end) => name.toLowerCase().endsWith(end))) continue;
  cpSync(join(SITE, name), join(OUT, name), { recursive: true });
  count += 1;
}

console.log("copy-site: 가게 파일 " + count + "개를 public 폴더로 복사했습니다");
