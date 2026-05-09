import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
const packageDir = join(distDir, "phone-sop-vision-demo-linux-x64");
const binaryPath = join(packageDir, "sop-vision-demo");
const tarballPath = join(distDir, "phone-sop-vision-demo-linux-x64.tar.gz");
const seaConfigPath = join(rootDir, "apps", "phone-sop-vision-demo", "sea-config.json");
const blobPath = join(distDir, "sop-vision-demo.blob");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

await mkdir(distDir, { recursive: true });
await rm(packageDir, { recursive: true, force: true });
await rm(tarballPath, { force: true });
await mkdir(packageDir, { recursive: true });

console.log("Generating Node SEA preparation blob...");
run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

console.log("Copying Node runtime...");
await copyFile(process.execPath, binaryPath, constants.COPYFILE_FICLONE_FORCE).catch(async () => {
  await copyFile(process.execPath, binaryPath);
});

console.log("Injecting application blob into runtime...");
run(
  process.platform === "win32"
    ? join(rootDir, "node_modules", ".bin", "postject.cmd")
    : join(rootDir, "node_modules", ".bin", "postject"),
  [
    binaryPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ]
);

run("chmod", ["755", binaryPath]);

await writeFile(
  join(packageDir, "README.md"),
  `# 手机检测与包装 AI 视觉 SOP 合规检测系统

## 运行

\`\`\`bash
./sop-vision-demo --host 127.0.0.1 --port 4788 --no-open
\`\`\`

启动后在浏览器打开终端打印的本地地址，例如：

\`\`\`text
http://127.0.0.1:4788
\`\`\`

## 参数

- \`--host <host>\`：监听地址，默认 \`127.0.0.1\`
- \`--port <port>\`：监听端口，默认 \`4788\`
- \`--no-open\`：不自动打开浏览器
- \`--help\`：查看帮助

## 演示能力

- 手机检测与包装 SOP 五步流程
- 实时 ROI、AI 检测框和手部关键点可视化
- Idle / Running / Done / NG 状态机
- 正常顺序、漏放说明书、手机提前放入三种演示场景
- 检测日志、指标面板和 JSON 检测记录导出

该包为独立 Linux x64 二进制演示包，不依赖本机 Node.js。
`,
  "utf8"
);

console.log("Creating tar.gz package...");
run("tar", ["-czf", tarballPath, "-C", distDir, "phone-sop-vision-demo-linux-x64"]);

console.log("");
console.log(`Binary: ${binaryPath}`);
console.log(`Package: ${tarballPath}`);
