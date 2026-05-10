import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
const cacheDir = join(distDir, ".cache");
const linuxPackageDir = join(distDir, "phone-sop-vision-demo-linux-x64");
const linuxBinaryPath = join(linuxPackageDir, "sop-vision-demo");
const linuxTarballPath = join(distDir, "phone-sop-vision-demo-linux-x64.tar.gz");
const windowsPackageDir = join(distDir, "phone-sop-vision-demo-windows-x64");
const windowsBinaryPath = join(windowsPackageDir, "sop-vision-demo.exe");
const windowsZipPath = join(distDir, "phone-sop-vision-demo-windows-x64.zip");
const seaConfigPath = join(rootDir, "apps", "phone-sop-vision-demo", "sea-config.json");
const blobPath = join(distDir, "sop-vision-demo.blob");
const postjectBin =
  process.platform === "win32"
    ? join(rootDir, "node_modules", ".bin", "postject.cmd")
    : join(rootDir, "node_modules", ".bin", "postject");

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

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyExecutable(source, target) {
  await copyFile(source, target, constants.COPYFILE_FICLONE_FORCE).catch(async () => {
    await copyFile(source, target);
  });
}

function injectSeaBlob(binaryPath) {
  run(postjectBin, [
    binaryPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ]);
}

async function writePackageReadme(packageDir, platformLabel, command) {
  await writeFile(
    join(packageDir, "README.md"),
    `# AI 视觉 SOP 合规检测系统

## 运行

\`\`\`bash
${command}
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

- 正面 / 反面 / 整体三步 SOP 检测流程
- 实时 ROI、AI 检测框和手部关键点可视化
- Idle / Running / Pass / Failed 状态机
- 正常检测、正面失败、反面失败、整体失败四种演示场景
- 正面/反面失败提示：本次操作未按照SOP规范检测
- 整体前置失败提示：由于正面（反面）检测操作不符合SOP规范，请重新检测。
- 检测日志、指标面板和 JSON 检测记录导出

该包为独立 ${platformLabel} 二进制演示包，不依赖本机 Node.js。
`,
    "utf8"
  );
}

async function buildLinuxPackage() {
  await rm(linuxPackageDir, { recursive: true, force: true });
  await rm(linuxTarballPath, { force: true });
  await mkdir(linuxPackageDir, { recursive: true });

  console.log("Copying Linux Node runtime...");
  await copyExecutable(process.execPath, linuxBinaryPath);

  console.log("Injecting application blob into Linux runtime...");
  injectSeaBlob(linuxBinaryPath);
  run("chmod", ["755", linuxBinaryPath]);

  await writePackageReadme(
    linuxPackageDir,
    "Linux x64",
    "./sop-vision-demo --host 127.0.0.1 --port 4788 --no-open"
  );

  console.log("Creating Linux tar.gz package...");
  run("tar", ["-czf", linuxTarballPath, "-C", distDir, "phone-sop-vision-demo-linux-x64"]);
}

async function ensureWindowsNodeRuntime() {
  await mkdir(cacheDir, { recursive: true });
  const nodeVersion = process.version;
  const nodeZipName = `node-${nodeVersion}-win-x64.zip`;
  const nodeZipPath = join(cacheDir, nodeZipName);
  const extractedDir = join(cacheDir, `node-${nodeVersion}-win-x64`);
  const nodeExePath = join(extractedDir, "node.exe");

  if (!(await pathExists(nodeZipPath))) {
    const downloadUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeZipName}`;
    console.log(`Downloading Windows Node runtime: ${downloadUrl}`);
    run("curl", ["-fL", downloadUrl, "-o", nodeZipPath]);
  }

  if (!(await pathExists(nodeExePath))) {
    console.log("Extracting Windows Node runtime...");
    await rm(extractedDir, { recursive: true, force: true });
    run("unzip", ["-q", nodeZipPath, "-d", cacheDir]);
  }

  return nodeExePath;
}

async function buildWindowsPackage() {
  await rm(windowsPackageDir, { recursive: true, force: true });
  await rm(windowsZipPath, { force: true });
  await mkdir(windowsPackageDir, { recursive: true });

  const nodeExePath = await ensureWindowsNodeRuntime();
  console.log("Copying Windows Node runtime...");
  await copyExecutable(nodeExePath, windowsBinaryPath);

  console.log("Injecting application blob into Windows runtime...");
  injectSeaBlob(windowsBinaryPath);

  await writePackageReadme(
    windowsPackageDir,
    "Windows x64",
    ".\\sop-vision-demo.exe --host 127.0.0.1 --port 4788 --no-open"
  );

  console.log("Creating Windows zip package...");
  run("zip", ["-qr", windowsZipPath, "phone-sop-vision-demo-windows-x64"], { cwd: distDir });
}

await mkdir(distDir, { recursive: true });

console.log("Generating Node SEA preparation blob...");
run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

await buildLinuxPackage();
await buildWindowsPackage();

console.log("");
console.log(`Linux binary: ${linuxBinaryPath}`);
console.log(`Linux package: ${linuxTarballPath}`);
console.log(`Windows binary: ${windowsBinaryPath}`);
console.log(`Windows package: ${windowsZipPath}`);
