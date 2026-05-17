# Cursor 沙箱在 Linux、Windows、macOS 下的使用、配置与差异

本文总结 Cursor Agent/CLI 沙箱在 Linux、Windows、macOS 场景下的共同点、差异，以及本仓库提供的三份示例配置文件。

## 生成的配置文件

本仓库已提供三份可复制使用的示例：

- Linux: [`docs/cursor-sandbox-configs/sandbox.linux.json`](cursor-sandbox-configs/sandbox.linux.json)
- macOS: [`docs/cursor-sandbox-configs/sandbox.macos.json`](cursor-sandbox-configs/sandbox.macos.json)
- Windows WSL2: [`docs/cursor-sandbox-configs/sandbox.windows-wsl2.json`](cursor-sandbox-configs/sandbox.windows-wsl2.json)

使用时将对应文件复制为以下任一位置的 `sandbox.json`：

```text
~/.cursor/sandbox.json          # 用户级配置，对所有 workspace 生效
<repo>/.cursor/sandbox.json     # 项目级配置，只对当前 workspace 生效
```

用户级与项目级配置可以同时存在，Cursor 会合并它们；项目级配置优先级更高。团队策略与 Cursor 内置安全规则优先级更高，不能通过本地 `sandbox.json` 放宽。

## 是否一致

结论：**使用入口和配置格式基本一致，但能力范围与底层实现不完全一致**。

| 维度 | Linux | macOS | Windows |
| --- | --- | --- | --- |
| 是否支持沙箱 | 支持 | 支持 | 支持，但依赖 WSL2 |
| 主要实现 | Landlock + seccomp，部分环境可能使用 Bubblewrap fallback | Apple Seatbelt / `sandbox-exec` | 在 WSL2 中使用 Linux 类沙箱能力 |
| 配置文件格式 | `sandbox.json` | `sandbox.json` | WSL 内的 `sandbox.json` |
| 路径风格 | Linux 路径，如 `/home/user/project` | macOS 路径，如 `/Users/user/project` | 建议使用 WSL/Linux 路径，如 `/home/user/project` 或 `/mnt/c/...` |
| 文件系统隔离 | 支持，受 Linux 内核能力影响 | 支持，基于 Seatbelt profile | 作用于 WSL2 环境，不是完整原生 Windows 沙箱 |
| 网络策略 | 支持 `networkPolicy` | 支持 `networkPolicy` | WSL2 内支持 `networkPolicy` |
| 典型前提 | Linux kernel 6.2+、Landlock v3、启用 unprivileged user namespaces | Cursor v2.0+，通常开箱即用 | 安装并配置 WSL2 |

## 使用方式

### Cursor IDE / Agent

在 Cursor 设置中进入：

```text
Settings > Cursor Settings > Agents > Auto-Run
```

常见模式：

- `Run in Sandbox`：自动命令在沙箱内执行。
- `Ask Every Time`：每次执行命令前询问。
- `Run Everything`：不使用沙箱自动执行，安全风险最高。

网络策略通常还会有类似以下模式：

- `sandbox.json Only`：只按本地 `sandbox.json` 放行。
- `sandbox.json + Defaults`：本地配置叠加 Cursor 默认允许列表。
- `Allow All`：允许全部网络访问。

### Cursor CLI

CLI 可通过命令或参数切换沙箱：

```bash
cursor-agent --sandbox enabled
cursor-agent --sandbox disabled
```

交互式会话中也可使用：

```text
/sandbox
```

## 配置格式

三端使用同一类 `sandbox.json` 结构：

```json
{
  "type": "workspace_readwrite",
  "additionalReadwritePaths": [],
  "additionalReadonlyPaths": [],
  "disableTmpWrite": false,
  "enableSharedBuildCache": true,
  "networkPolicy": {
    "default": "deny",
    "allow": [
      "github.com",
      "codeload.github.com",
      "*.githubusercontent.com"
    ],
    "deny": [
      "127.0.0.0/8",
      "10.0.0.0/8"
    ]
  }
}
```

字段说明：

- `type`
  - `workspace_readwrite`：workspace 内可读写，常用默认值。
  - `workspace_readonly`：workspace 只读。
  - `insecure_none`：关闭沙箱，不建议用于日常 Agent 自动执行。
- `additionalReadwritePaths`：允许额外读写的路径。
- `additionalReadonlyPaths`：允许额外只读的路径。
- `disableTmpWrite`：是否禁止写入系统临时目录。
- `enableSharedBuildCache`：共享常见构建缓存，减少重复安装依赖。
- `networkPolicy.default`
  - `deny`：默认拒绝网络，再显式放行需要的域名或 CIDR。
  - `allow`：默认允许网络，再显式拒绝高风险目标。
- `networkPolicy.allow`：允许的域名、通配域名或 CIDR。
- `networkPolicy.deny`：拒绝的域名、通配域名或 CIDR，优先级最高。

## 能力范围与限制

### 文件系统

共同点：

- 默认让 Agent 在 workspace 内读写，适合代码修改、构建、测试。
- 可以通过 `additionalReadwritePaths` 和 `additionalReadonlyPaths` 扩展访问范围。
- 临时目录默认可写，除非设置 `disableTmpWrite: true`。
- 某些敏感路径会被 Cursor 保护，本地配置不能削弱这些保护。

常见受保护内容包括：

- `.cursor/*.json`
- `.cursor/**/*.json`
- `.cursor/.workspace-trusted`
- `.claude/*.json`
- `.vscode/**`
- `.code-workspace`
- `.git/hooks/**`
- `.git/config`
- `.git/info/attributes`
- `.cursorignore`

Linux 额外注意：

- 依赖 Landlock 等内核能力；环境不满足时，Cursor 可能退回到执行前请求批准。
- 沙箱内 UID 可能显示为 `0`，如需原始用户信息可读取 `CURSOR_ORIG_UID` 和 `CURSOR_ORIG_GID`。

macOS 额外注意：

- 使用 Apple Seatbelt 限制子进程树。
- 通常不需要额外系统配置。

Windows 额外注意：

- Cursor 的 Windows 沙箱能力依赖 WSL2。
- 配置文件应放在 WSL 环境中的 `~/.cursor/sandbox.json` 或 WSL workspace 下的 `.cursor/sandbox.json`。
- 尽量使用 WSL/Linux 风格路径；访问 Windows 盘符时使用 `/mnt/c/...` 形式。

### 网络

共同点：

- 可以通过 `networkPolicy` 做默认拒绝、显式放行。
- 支持域名、通配域名和 CIDR。
- 建议对自动执行场景使用 `"default": "deny"`，只放行包管理器、代码托管、制品仓库等必要目标。

建议始终拒绝：

- 本机回环地址：`127.0.0.0/8`
- RFC1918 私有网段：`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`
- 云元数据地址：`169.254.169.254`

### 进程与命令执行

共同点：

- Agent 终端命令在 `Run in Sandbox` 模式下默认进入沙箱。
- 需要完整系统权限的命令可能触发批准流程。
- 命令 allowlist 是便利机制，不应视为安全边界。

平台差异：

- Linux 通过 Landlock 限制文件系统，并通过 seccomp 限制部分危险 syscall。
- macOS 通过 Seatbelt profile 限制子进程树。
- Windows 通过 WSL2 间接获得 Linux 类限制，无法覆盖所有原生 Windows 进程场景。

## 三份示例的设计原则

本仓库中的示例配置采用相同安全基线：

- workspace 内可读写。
- 默认拒绝网络。
- 只允许常见开发依赖来源，如 GitHub、npm、PyPI、Go、Cargo 或 GHCR。
- 显式拒绝本机、私有网段和云元数据地址。
- 启用共享构建缓存。

如果项目需要访问私有包仓库、公司内网制品库或自建 Git 服务，应把对应域名加入 `networkPolicy.allow`，不要把 `networkPolicy.default` 改成 `allow`，除非明确接受更大的网络访问面。

## 官方文档参考

- Cursor documentation index: `https://cursor.com/llms.txt`
- `docs/agent/tools/terminal.md`
- `docs/reference/sandbox.md`
- `docs/agent/security.md`
- `docs/reference/permissions.md`
- `docs/cli/overview.md`
- `docs/cli/reference/configuration.md`
- `docs/cli/reference/permissions.md`
- `docs/cli/reference/parameters.md`
- Cursor blog: `blog/agent-sandboxing`
