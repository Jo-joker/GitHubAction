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
const macosX64PackageDir = join(distDir, "phone-sop-vision-demo-macos-x64");
const macosX64BinaryPath = join(macosX64PackageDir, "sop-vision-demo");
const macosX64TarballPath = join(distDir, "phone-sop-vision-demo-macos-x64.tar.gz");
const macosArm64PackageDir = join(distDir, "phone-sop-vision-demo-macos-arm64");
const macosArm64BinaryPath = join(macosArm64PackageDir, "sop-vision-demo");
const macosArm64TarballPath = join(distDir, "phone-sop-vision-demo-macos-arm64.tar.gz");
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

function injectSeaBlob(binaryPath, options = {}) {
  const args = [
    binaryPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ];
  if (options.machoSegmentName) {
    args.push("--macho-segment-name", options.machoSegmentName);
  }
  run(postjectBin, args);
}

async function writePackageReadme(packageDir, platformLabel, command, extraNotes = "") {
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
- 左侧实时监测画面循环播放指定视频 31-43 秒实拍关键帧
- Idle / Running / Pass / Failed 状态机
- 正常检测、正面失败、反面失败、整体失败四种演示场景
- 正面/反面失败提示：本次操作未按照SOP规范检测
- 整体前置失败提示：由于正面（反面）检测操作不符合SOP规范，请重新检测。
- 检测日志、指标面板和 JSON 检测记录导出

该包为独立 ${platformLabel} 二进制演示包，不依赖本机 Node.js。

${extraNotes}
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

async function ensureMacosNodeRuntime(arch) {
  await mkdir(cacheDir, { recursive: true });
  const nodeVersion = process.version;
  const nodeArchiveName = `node-${nodeVersion}-darwin-${arch}.tar.gz`;
  const nodeArchivePath = join(cacheDir, nodeArchiveName);
  const extractedDir = join(cacheDir, `node-${nodeVersion}-darwin-${arch}`);
  const nodeBinaryPath = join(extractedDir, "bin", "node");

  if (!(await pathExists(nodeArchivePath))) {
    const downloadUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeArchiveName}`;
    console.log(`Downloading macOS Node runtime (${arch}): ${downloadUrl}`);
    run("curl", ["-fL", downloadUrl, "-o", nodeArchivePath]);
  }

  if (!(await pathExists(nodeBinaryPath))) {
    console.log(`Extracting macOS Node runtime (${arch})...`);
    await rm(extractedDir, { recursive: true, force: true });
    run("tar", ["-xzf", nodeArchivePath, "-C", cacheDir]);
  }

  return nodeBinaryPath;
}

async function buildMacosPackage(arch, packageDir, binaryPath, tarballPath) {
  await rm(packageDir, { recursive: true, force: true });
  await rm(tarballPath, { force: true });
  await mkdir(packageDir, { recursive: true });

  const nodeBinaryPath = await ensureMacosNodeRuntime(arch);
  console.log(`Copying macOS Node runtime (${arch})...`);
  await copyExecutable(nodeBinaryPath, binaryPath);

  console.log(`Injecting application blob into macOS runtime (${arch})...`);
  injectSeaBlob(binaryPath, { machoSegmentName: "NODE_SEA" });
  run("chmod", ["755", binaryPath]);

  await writePackageReadme(
    packageDir,
    `macOS ${arch}`,
    "./sop-vision-demo --host 127.0.0.1 --port 4788 --no-open",
    `## macOS 安全提示

该可执行文件在 Linux 构建机上生成，未经过 Apple Developer ID 公证。如果 macOS 拦截运行，请在解压目录执行：

\`\`\`bash
chmod +x ./sop-vision-demo
xattr -dr com.apple.quarantine ./sop-vision-demo 2>/dev/null || true
codesign --force --sign - ./sop-vision-demo 2>/dev/null || true
./sop-vision-demo --no-open
\`\`\`

Apple Silicon 机器优先使用 \`macos-arm64\` 包，Intel Mac 使用 \`macos-x64\` 包。`
  );

  console.log(`Creating macOS ${arch} tar.gz package...`);
  run("tar", ["-czf", tarballPath, "-C", distDir, `phone-sop-vision-demo-macos-${arch}`]);
}

await mkdir(distDir, { recursive: true });

console.log("Generating Node SEA preparation blob...");
run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

await buildLinuxPackage();
await buildWindowsPackage();
await buildMacosPackage("x64", macosX64PackageDir, macosX64BinaryPath, macosX64TarballPath);
await buildMacosPackage("arm64", macosArm64PackageDir, macosArm64BinaryPath, macosArm64TarballPath);

console.log("");
console.log(`Linux binary: ${linuxBinaryPath}`);
console.log(`Linux package: ${linuxTarballPath}`);
console.log(`Windows binary: ${windowsBinaryPath}`);
console.log(`Windows package: ${windowsZipPath}`);
console.log(`macOS x64 binary: ${macosX64BinaryPath}`);
console.log(`macOS x64 package: ${macosX64TarballPath}`);
console.log(`macOS arm64 binary: ${macosArm64BinaryPath}`);
console.log(`macOS arm64 package: ${macosArm64TarballPath}`);
