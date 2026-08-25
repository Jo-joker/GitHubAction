---
emoji: 🔁
description: Sample GitHub Agentic Workflow pipeline for the CodeArts Check Action. Reviews action/workflow changes, inspects related CI, and posts a concise pipeline report.
on:
  workflow_dispatch:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    paths:
      - "action.yaml"
      - "index.js"
      - ".github/workflows/**"
      - "package.json"
      - "package-lock.json"
  workflow_run:
    workflows: ["CodeArts Check Analyze"]
    types: [completed]
    branches:
      - main
if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
permissions:
  contents: read
  pull-requests: read
  actions: read
  issues: read
  checks: read
  copilot-requests: write
network: defaults
tools:
  github:
    mode: gh-proxy
    toolsets: [default, actions]
safe-outputs:
  mentions: false
  add-comment:
    max: 1
    hide-older-comments: true
  create-issue:
    title-prefix: "[CodeArts CI Pipeline] "
    labels: [ci, agentic, report]
    close-older-issues: true
    expires: 14
    max: 1
  noop:

---

# CodeArts Check Agentic 流水线样例

这是一份可编译、可运行的 GitHub Agentic Workflow 样例。YAML frontmatter 定义触发、权限和安全输出；下方 Markdown 是 Agent 执行指令。

编译命令：`gh aw compile sample-agentic-pipeline`

## Task

审查本仓库 CodeArts Check GitHub Action 流水线，并产出一份简短、可执行的报告。

触发上下文：

- `pull_request`：审查当前 PR 对 `action.yaml`、`index.js`、工作流 YAML 的改动。
- `workflow_run`：审查刚完成的 `CodeArts Check Analyze` 运行结果。
- `workflow_dispatch`：审查默认分支上的当前流水线定义。

## 阶段 1：采集上下文

使用 `gh`（github gh-proxy）读取最少必要信息：

1. 读取 `action.yaml`、`index.js`、`.github/workflows/codearts-check.yml`。
2. 若是 PR，读取 diff、检查状态、已有 bot 评论。
3. 若是 `workflow_run`，读取该 run 的 jobs、结论、失败日志摘要。
4. 搜索已有 `[CodeArts CI Pipeline]` issue，避免重复报告。

## 阶段 2：审查流水线

重点检查：

- Action 输入是否完整：CodeArts/IAM 认证、任务字段、报告上传字段。
- 密钥是否只通过 GitHub Secrets 注入，有无明文凭证。
- 轮询超时、`fail_on_job_failure`、报告仓库写权限是否合理。
- 工作流权限是否过宽（当前样例应保持 `contents: read`）。
- 任务名是否固定导致重复创建失败。

## 阶段 3：评估风险

按阻塞 / 警告 / 建议分级。没有实质问题就不要编造风险。

## 阶段 4：输出报告

报告使用 GitHub-flavored markdown，章节从 `###` 开始。结构：

### Summary

- 触发事件、审查范围、结论（通过 / 需关注 / 阻塞）

### Findings

- 每条发现包含：位置、风险、建议

### Recommendations

- 最多 5 条可执行下一步

<details>
<summary>Details</summary>

补充 diff、日志或配置摘录。

</details>

**References:** 最多 3 个相关 run / PR / issue 链接，格式 `[§12345](https://github.com/owner/repo/actions/runs/12345)`。

## Safe Outputs

- PR 事件：用 `add-comment` 把报告发到该 PR，并覆盖本工作流的旧评论。
- `workflow_run` 或 `workflow_dispatch`：用 `create-issue` 发布报告。标题带 `[CodeArts CI Pipeline]` 前缀，正文至少 20 个字符。
- 无实质发现、无失败、无需跟进：调用 `noop`，用一句话说明原因，例如 `noop("No material pipeline findings on PR #12")`。
- 不要直接用 `gh` 写 issue / comment / PR。
- 结束前必须调用上述其中一个 safe output。
