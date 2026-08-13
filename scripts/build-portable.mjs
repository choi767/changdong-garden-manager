import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_VERSION = "V1.4";
const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const packageDir = path.join(projectRoot, "mobile-package");
const embeddedBackupPath = process.env.EMBED_BACKUP_JSON
  ? path.resolve(projectRoot, process.env.EMBED_BACKUP_JSON)
  : path.join(projectRoot, "portable-current-data.json");
const htmlPath = path.join(distDir, "index.html");
const outputHtmlPath = path.join(packageDir, `창동-틀밭관리-${APP_VERSION}-mobile.html`);
const guidePath = path.join(packageDir, `실행방법-${APP_VERSION}.txt`);

function resolveDistAsset(assetPath) {
  const clean = assetPath.replace(/^\.\//, "").replace(/^\//, "");
  return path.join(distDir, clean);
}

let html = await readFile(htmlPath, "utf8");

html = await replaceAsync(html, /<link rel="stylesheet" crossorigin href="([^"]+)">/g, async (_match, href) => {
  const css = await readFile(resolveDistAsset(href), "utf8");
  return `<style>\n${css}\n</style>`;
});

html = await replaceAsync(html, /<script type="module" crossorigin src="([^"]+)"><\/script>/g, async (_match, src) => {
  const js = await readFile(resolveDistAsset(src), "utf8");
  return `<script type="module">\n${js}\n</script>`;
});

html = html.replace(
  "</head>",
  [
    '<meta name="application-name" content="창동 틀밭관리">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="theme-color" content="#226b45">',
    await makeEmbeddedBackupScript(),
    "</head>"
  ].join("\n")
);

await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
await writeFile(outputHtmlPath, html, "utf8");
await writeFile(guidePath, makeGuide(), "utf8");

console.log(`Created ${outputHtmlPath}`);
console.log(`Created ${guidePath}`);

async function replaceAsync(input, regex, replacer) {
  const matches = [...input.matchAll(regex)];
  let result = input;
  for (const match of matches.reverse()) {
    const replacement = await replacer(...match);
    result = result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
  }
  return result;
}

function makeGuide() {
  return `창동 틀밭관리 프로그램 ${APP_VERSION} - 휴대폰 테스트 실행방법

1. 압축파일을 휴대폰에 받은 뒤 압축을 풉니다.
2. "창동-틀밭관리-${APP_VERSION}-mobile.html" 파일을 Chrome 또는 Samsung Internet으로 엽니다.
3. WiFi나 인터넷 연결 없이도 실행됩니다.
4. 처음 실행하는 휴대폰에는 이 파일에 포함된 기본 데이터가 자동으로 들어갑니다.
5. 이미 같은 파일을 실행한 적이 있는 휴대폰은 브라우저 저장소의 기존 데이터가 우선 표시됩니다.

주의:
- 휴대폰에서 입력한 기록은 그 휴대폰 브라우저 저장소에 저장됩니다.
- 다른 사람에게 테스트를 부탁할 때는 압축파일 하나만 보내면 됩니다.
- 데이터 백업/복원은 앱의 "설정" 화면에서 JSON 백업/복원을 사용합니다.
- 파일 실행 방식이라 주소에 "#/plants", "#/settings"처럼 표시될 수 있으며 정상 동작입니다.
`;
}

async function makeEmbeddedBackupScript() {
  try {
    const backupJson = await readFile(embeddedBackupPath, "utf8");
    const backup = JSON.parse(backupJson);
    const plantCount = backup?.data?.plants?.length ?? 0;
    const groupCount = backup?.data?.managementGroups?.length ?? 0;
    return `<script>window.__CHANGDONG_EMBEDDED_BACKUP__=${JSON.stringify(backup)};window.__CHANGDONG_EMBEDDED_BACKUP_SUMMARY__=${JSON.stringify({ plantCount, groupCount, source: path.basename(embeddedBackupPath) })};</script>`;
  } catch {
    return "<script>window.__CHANGDONG_EMBEDDED_BACKUP__=undefined;</script>";
  }
}
