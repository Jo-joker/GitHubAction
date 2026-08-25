# GitHub Agentic Workflows 流水线样例集

> GitHub Agentic Workflows 是 GitHub 推出的 AI 原生仓库自动化能力，允许开发者用 **Markdown + YAML frontmatter** 定义工作流，由 AI 编码智能体（Copilot / Claude / Codex / Gemini）在 GitHub Actions 中执行。与传统的 if-then 规则式 YAML 不同，Agentic Workflow 使用自然语言指令 + 上下文推理完成任务。

## 目录

- [核心概念](#核心概念)
- [样例 1：Issue 自动分类与标签](#样例-1issue-自动分类与标签)
- [样例 2：PR 代码审查](#样例-2pr-代码审查)
- [样例 3：CI 失败自动排查与修复](#样例-3ci-失败自动排查与修复)
- [样例 4：每日仓库状态报告](#样例-4每日仓库状态报告)
- [样例 5：Issue 转 PR 自动实现](#样例-5issue-转-pr-自动实现)
- [样例 6：文档与代码同步更新](#样例-6文档与代码同步更新)
- [样例 7：多 Agent 协作的安全审计流水线（传统 YAML 模式）](#样例-7多-agent-协作的安全审计流水线传统-yaml-模式)
- [Frontmatter 参考](#frontmatter-参考)
- [安全机制](#安全机制)

---

## 核心概念

每个 Agentic Workflow 由两个文件组成：

| 文件 | 说明 |
|---|---|
| `.github/workflows/my-workflow.md` | Agentic Workflow 定义文件（frontmatter + 自然语言指令） |
| `.github/workflows/my-workflow.lock.yml` | 编译后的 GitHub Actions 工作流文件（由 `gh aw compile` 自动生成） |

**工作流程**：

```
定义 .md 文件 → gh aw compile → 生成 .lock.yml → 提交两个文件 → Actions 触发执行
```

**支持的 AI 引擎**：

| 引擎 | `engine` 值 | 认证方式 |
|---|---|---|
| GitHub Copilot | `copilot`（默认） | 组织仓库无需额外配置；个人仓库需 `COPILOT_GITHUB_TOKEN` |
| Anthropic Claude | `claude` | `ANTHROPIC_API_KEY` |
| OpenAI Codex | `codex` | `OPENAI_API_KEY` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` |

---

## 样例 1：Issue 自动分类与标签

**文件**: `.github/workflows/issue-triage.md`

```markdown
---
on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: read
  copilot-requests: write

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  add-label:
    max: 3
  add-comment:
    max: 1

---

# Issue Triage Assistant

When a new issue is opened, analyze its title and body to classify it.

## Classification Rules

1. Read the issue title, body, and any linked context.
2. Determine the issue type:
   - **bug**: Reports of broken or incorrect behavior
   - **feature**: Requests for new functionality
   - **question**: General questions or support requests
   - **documentation**: Issues about docs improvements
3. Determine the priority:
   - **priority/critical**: Security vulnerabilities, data loss, or complete feature breakage
   - **priority/high**: Major functionality issues affecting many users
   - **priority/medium**: Minor issues with workarounds available
   - **priority/low**: Cosmetic issues, typos, or nice-to-haves
4. Determine the area by scanning for keywords related to known components
   (e.g., `auth`, `api`, `ui`, `database`, `ci`).

## Actions

- Add up to 3 labels: one for type, one for priority, one for area.
- Post a brief comment acknowledging the issue and summarizing your classification.
  If it's a bug, ask the reporter to confirm the reproduction steps.
```

---

## 样例 2：PR 代码审查

**文件**: `.github/workflows/pr-review.md`

```markdown
---
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]

permissions:
  contents: read
  pull-requests: read
  copilot-requests: write

engine: claude

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  add-comment:
    max: 1
  add-review:
    max: 1

max-ai-credits: 500

---

# PR Code Review

Review every non-draft pull request for code quality, bugs, and security issues.

## Review Focus Areas

1. **Logic errors and bugs**: Off-by-one errors, null dereferences, race conditions,
   incorrect conditional logic.
2. **Security vulnerabilities**: SQL injection, XSS, authentication bypasses,
   hardcoded secrets, insecure deserialization.
3. **Performance concerns**: N+1 queries, unnecessary allocations, blocking calls
   in async paths, missing indexes.
4. **Error handling**: Uncaught exceptions, swallowed errors, missing retry logic
   for network calls.
5. **API contract changes**: Breaking changes to public APIs, missing backward
   compatibility.

## Review Format

Post a single review with the following structure:

### Summary
One paragraph overview of the changes and overall assessment.

### Issues Found
For each issue:
- File path and line number
- Severity: `critical` / `warning` / `suggestion`
- Explanation of the problem and suggested fix

### Positive Notes
Highlight 1-2 things done well.

## Rules

- Do NOT comment on code style, formatting, or naming unless it causes a genuine
  readability or correctness problem.
- Skip draft pull requests.
- Skip pull requests that only modify `.md` files, `LICENSE`, or `.gitignore`.
- If no issues are found, post a short approval comment.
```

---

## 样例 3：CI 失败自动排查与修复

**文件**: `.github/workflows/ci-fix.md`

```markdown
---
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

permissions:
  contents: read
  actions: read
  pull-requests: read
  copilot-requests: write

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  add-comment:
    max: 1
  create-pull-request:
    max: 1

---

# CI Failure Investigator

When the CI workflow fails on a pull request, investigate the failure and suggest
or apply a fix.

## Investigation Steps

1. Check if the triggering workflow concluded with a failure. If it succeeded, stop
   immediately and do nothing.
2. Retrieve the failed workflow run logs using the GitHub API.
3. Identify the failing job and step.
4. Read the error output and stack trace.
5. Cross-reference the error with the source code changed in the associated pull
   request.

## Diagnosis

Classify the failure into one of these categories:

- **Test failure**: A unit/integration test assertion failed.
- **Build failure**: Compilation or dependency resolution error.
- **Lint failure**: Code style or static analysis violation.
- **Flaky test**: The test has failed intermittently in recent runs with no code change.
- **Infrastructure**: Runner timeout, network error, or resource exhaustion.

## Response

- For **test/build/lint failures**: Post a comment on the PR explaining the root
  cause and a concrete code fix. If the fix is a single-file change with high
  confidence, open a fix PR targeting the same branch.
- For **flaky tests**: Post a comment noting the flaky test history and suggest
  skipping or quarantining it. Do NOT open a fix PR.
- For **infrastructure failures**: Post a comment recommending a re-run. Do NOT
  open a fix PR.
```

---

## 样例 4：每日仓库状态报告

**文件**: `.github/workflows/daily-status.md`

```markdown
---
on: daily

permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  create-issue:
    max: 1

max-ai-credits: 200

---

# Daily Repository Status Report

Review the repository's activity from the last 24 hours and create a summary issue.

## Data to Collect

1. **Merged pull requests**: List each with title, author, and a one-line summary.
2. **Closed issues**: List with resolution type (fixed, wontfix, duplicate).
3. **Newly opened issues**: List with initial triage assessment.
4. **Open PRs awaiting review**: List with age in days and reviewers assigned.
5. **CI health**: Number of passing vs failing runs in the last 24 hours.

## Report Format

Create an issue titled `📊 Daily Status — YYYY-MM-DD` with:

- A brief executive summary (2-3 sentences).
- Sections for each data category above.
- A "Blockers & Risks" section highlighting any PR open for more than 5 days
  or any issue labeled `priority/critical` that remains unresolved.
- A "Recommended Actions" section with 2-3 concrete next steps.

Keep the report concise. If there was very little activity, say so briefly rather
than padding the report.
```

---

## 样例 5：Issue 转 PR 自动实现

**文件**: `.github/workflows/issue-to-pr.md`

```markdown
---
on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write

engine: claude

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  add-comment:
    max: 2
  create-pull-request:
    max: 1

max-ai-credits: 1000

---

# Implement Issue as Pull Request

When a maintainer comments `@agent implement` on an issue, read the issue
description and implement the requested changes as a pull request.

## Trigger Validation

1. Only proceed if the comment body contains the exact phrase `@agent implement`.
2. Only proceed if the commenter has `write` or `admin` permission on the repository.
3. If the issue already has a linked pull request, post a comment noting the
   existing PR and stop.

## Implementation Process

1. Read the full issue description, all comments, and any referenced issues or PRs.
2. Understand the existing codebase structure by reading relevant source files.
3. Plan the implementation:
   - List the files that need to be created or modified.
   - Describe the approach in 3-5 bullet points.
4. Post a comment on the issue with your implementation plan. Start working
   immediately without waiting for approval.
5. Implement the changes following existing code conventions:
   - Match the indentation style, naming conventions, and patterns in the codebase.
   - Add or update tests for any new functionality.
   - Update relevant documentation if applicable.
6. Create a pull request:
   - Branch name: `agent/issue-{number}`
   - PR title: the issue title prefixed with `fix:` or `feat:` as appropriate.
   - PR body: reference the issue with `Closes #{number}`, summarize the changes,
     and list any follow-up items.

## Guardrails

- Do NOT modify CI/CD configuration files (`.github/workflows/*`).
- Do NOT modify security-sensitive files (`.env*`, `*secret*`, `*.pem`, `*.key`).
- If the request is ambiguous or too large (would require changing more than
  10 files), post a comment asking for clarification instead of implementing.
```

---

## 样例 6：文档与代码同步更新

**文件**: `.github/workflows/docs-sync.md`

```markdown
---
on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "lib/**"

permissions:
  contents: read
  pull-requests: read
  copilot-requests: write

network: defaults

tools:
  github:
    toolsets: [default]

safe-outputs:
  create-pull-request:
    max: 1

---

# Documentation Sync

When source code changes are pushed to `main`, check if the documentation needs
to be updated and create a PR with the necessary changes.

## Process

1. Identify which source files were changed in the push event.
2. For each changed file, check if there is a corresponding documentation file
   in `docs/` or a reference in `README.md`.
3. Compare the current documentation against the updated source code:
   - Are function signatures still accurate?
   - Are code examples still valid?
   - Are configuration options documented?
4. If documentation is out of date, create a PR that updates only the affected
   documentation files.

## PR Format

- Branch name: `agent/docs-sync-{short-sha}`
- Title: `docs: sync documentation with recent code changes`
- Body: list each documentation change with a brief explanation of why it's needed.

## Rules

- Only update existing documentation; do NOT create new documentation files.
- Do NOT modify source code files.
- If no documentation updates are needed, do nothing (no PR, no comment).
```

---

## 样例 7：多 Agent 协作的安全审计流水线（传统 YAML 模式）

> 这是一个使用传统 GitHub Actions YAML 直接调用 AI Agent 的高级示例，展示如何在
> CI/CD 流水线中编排多个 AI 驱动的安全检查步骤。

**文件**: `.github/workflows/security-audit.yml`

```yaml
name: AI-Driven Security Audit Pipeline

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  schedule:
    - cron: "0 6 * * 1" # 每周一 UTC 06:00

permissions:
  contents: read
  pull-requests: write
  security-events: write
  issues: write

jobs:
  # ──────────────────────────────────────────────
  # Stage 1: 静态扫描（并行执行）
  # ──────────────────────────────────────────────
  sast-scan:
    name: SAST Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript, python

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif

  dependency-scan:
    name: Dependency Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy SCA
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL,HIGH

      - name: Upload Trivy SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-results.sarif

  secret-scan:
    name: Secret Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        continue-on-error: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ──────────────────────────────────────────────
  # Stage 2: AI Agent 综合研判
  # ──────────────────────────────────────────────
  ai-security-review:
    name: AI Security Review
    needs: [sast-scan, dependency-scan, secret-scan]
    if: always() && github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Download scan artifacts
        uses: actions/download-artifact@v4

      - name: AI Security Assessment
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are a senior application security engineer reviewing PR #${{ github.event.pull_request.number }}.

            ## Your Tasks

            1. Read the PR diff and understand the intent of the changes.
            2. Review any SARIF scan results available in the workspace.
            3. For each finding, assess:
               - Is it a true positive or false positive?
               - What is the actual exploitability in this codebase?
               - What is the recommended remediation?
            4. Check for security issues the static scanners may have missed:
               - Authentication/authorization logic flaws
               - Business logic vulnerabilities
               - Insecure data handling patterns
               - Missing input validation

            ## Output Format

            Post a single PR comment with:

            ### 🔒 Security Review Summary
            Overall risk assessment: LOW / MEDIUM / HIGH / CRITICAL

            ### Scanner Findings Triage
            | Finding | Scanner | Verdict | Reasoning |
            |---------|---------|---------|-----------|
            | ...     | ...     | TP/FP   | ...       |

            ### Additional Findings
            Issues discovered through manual code review that scanners missed.

            ### Recommendations
            Prioritized list of actions for the PR author.

  # ──────────────────────────────────────────────
  # Stage 3: 门禁决策
  # ──────────────────────────────────────────────
  security-gate:
    name: Security Gate
    needs: [sast-scan, dependency-scan, secret-scan, ai-security-review]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Evaluate gate
        run: |
          echo "Evaluating security gate..."
          SAST="${{ needs.sast-scan.result }}"
          DEP="${{ needs.dependency-scan.result }}"
          SECRET="${{ needs.secret-scan.result }}"

          if [[ "$SAST" == "failure" || "$DEP" == "failure" ]]; then
            echo "::error::Security gate FAILED — critical scanner findings detected."
            exit 1
          fi

          if [[ "$SECRET" == "failure" ]]; then
            echo "::warning::Secret detection found potential leaks. Review required."
          fi

          echo "✅ Security gate passed."
```

---

## Frontmatter 参考

Agentic Workflow `.md` 文件的 YAML frontmatter 支持以下字段：

| 字段 | 说明 | 示例 |
|---|---|---|
| `on` | 触发事件，语法同 GitHub Actions | `issues`, `pull_request`, `daily`, `weekly on monday` |
| `permissions` | 仓库权限授予（默认只读） | `contents: read`, `issues: write` |
| `safe-outputs` | 允许的写操作白名单 | `create-issue`, `add-comment`, `add-label`, `create-pull-request`, `add-review` |
| `engine` | AI 引擎选择 | `copilot`(默认), `claude`, `codex`, `gemini` |
| `network` | 网络访问策略 | `defaults`, `none` |
| `tools` | 可用工具集 | `github: { toolsets: [default] }` |
| `max-ai-credits` | 单次运行的推理费用上限（1 AIC = $0.01） | `500` |

### `safe-outputs` 可用操作

| 操作 | 说明 |
|---|---|
| `create-issue` | 创建 Issue |
| `add-comment` | 在 Issue/PR 上添加评论 |
| `add-label` | 为 Issue/PR 添加标签 |
| `create-pull-request` | 创建 Pull Request |
| `add-review` | 提交 PR Review |

每个操作可设置 `max` 限制单次运行的最大次数。

---

## 安全机制

GitHub Agentic Workflows 内置多层安全防护：

```
┌─────────────────────────────────────────────────────┐
│                  安全架构                             │
├──────────────────┬──────────────────────────────────┤
│ 默认只读权限      │ 未显式授权的操作一律拒绝            │
│ Safe Outputs     │ 写操作必须在 frontmatter 中声明     │
│ 密钥隔离          │ Secrets 不进入 Agent 运行时环境     │
│ 威胁检测          │ 输出在执行前扫描可疑/不安全内容      │
│ 防火墙隔离        │ Agent 在隔离的 Actions 容器中运行    │
│ 角色访问控制      │ 可限制谁能触发或修改 Agentic Workflow│
└──────────────────┴──────────────────────────────────┘
```

### 与传统方式的安全差异

| 维度 | 传统方式（YAML 中直接调用 Agent CLI） | Agentic Workflow |
|---|---|---|
| 默认权限 | Agent 可能获得超出任务所需的权限 | 默认只读，写操作需逐项声明 |
| 密钥暴露 | Agent 进程内可访问环境变量中的密钥 | 密钥隔离在下游 job，不进入 Agent 运行时 |
| 输出审查 | 无内置审查，Agent 输出直接生效 | Safe Outputs 子系统对输出做确定性过滤和威胁检测 |
| 网络访问 | 默认全网可达 | 可通过 `network` 字段限制 |

---

## 快速开始

```bash
# 1. 安装 GitHub CLI Agentic Workflows 扩展
gh extension install github/gh-aw

# 2. 在仓库中初始化（添加 skills 和 agent 配置）
gh aw init

# 3. 用 AI 创建 workflow（推荐方式）
# 在 Copilot CLI / Claude Code / Codex 中输入：
#   /agentic-workflows create a PR reviewer that checks for test coverage

# 4. 手动编译 .md → .lock.yml
gh aw compile .github/workflows/my-workflow.md

# 5. 提交两个文件
git add .github/workflows/my-workflow.md .github/workflows/my-workflow.lock.yml
git commit -m "feat: add agentic workflow for PR review"
git push

# 6. 查看运行日志和费用
gh aw logs
gh aw audit <RUN-ID>
```
