# CodeArts Check Report Action

GitHub Action for Huawei Cloud **CodeArts Check**:

1. Create a CodeArts Check task.
2. Run the created task immediately.
3. Poll until execution completes.
4. Fetch summary and defect details.
5. Generate a Markdown analysis report.
6. Upload the report to a target GitHub repository directory (default: `Jo-joker/maven-demo/analyze`).

## Inputs

### CodeArts / IAM

- `codearts_endpoint` (required): CodeArts Check endpoint, for example `https://codeartscheck.cn-north-4.myhuaweicloud.com`
- `codearts_token` (optional): `X-Auth-Token` for CodeArts Check APIs
- `iam_endpoint` (optional, default: `https://iam.myhuaweicloud.com`)
- `iam_username` (optional, required when `codearts_token` is empty)
- `iam_password` (optional, required when `codearts_token` is empty)
- `iam_domain_name` (optional, required when `codearts_token` is empty)
- `iam_project_name` (optional, required when `codearts_token` is empty)

### Task

- `project_id` (required)
- `project_name` (required)
- `repo_url` (required)
- `branch` (required, default: `main`)
- `task_name` (required)
- `repo_type` (required, default: `GitHub`)
- `rule_language` (required, default: `Java`)
- `auth_id` (optional)
- `auth_type` (optional)
- `run_ref` (optional): `pull` or `merge_request`
- `timeout_seconds` (optional, default: `1800`)
- `poll_interval_seconds` (optional, default: `15`)
- `include_status_ids` (optional, default: `0`)
- `max_defects` (optional, default: `500`)
- `fail_on_job_failure` (optional, default: `false`)

### Report upload

- `report_repo` (optional, default: `Jo-joker/maven-demo`)
- `report_dir` (optional, default: `analyze`)
- `report_branch` (optional, default: target repo default branch)
- `report_commit_message` (optional, default: `docs: add CodeArts Check analysis report`)
- `github_token` (required): token with `contents:write` on target repository

## Outputs

- `task_id`
- `exec_id`
- `job_status`
- `report_path`
- `report_url`
- `report_sha`

## Example workflow

```yaml
name: codearts-check

on:
  workflow_dispatch:

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Run CodeArts Check and upload report
        uses: Jo-joker/codearts-check-report-action@main
        with:
          codearts_endpoint: ${{ secrets.CODEARTS_ENDPOINT }}
          codearts_token: ${{ secrets.CODEARTS_TOKEN }}
          # If CODEARTS_TOKEN is not provided, configure IAM fields instead:
          # iam_endpoint: https://iam.myhuaweicloud.com
          # iam_username: ${{ secrets.HW_IAM_USERNAME }}
          # iam_password: ${{ secrets.HW_IAM_PASSWORD }}
          # iam_domain_name: ${{ secrets.HW_IAM_DOMAIN }}
          # iam_project_name: ${{ secrets.HW_IAM_PROJECT }}
          project_id: ${{ secrets.CODEARTS_PROJECT_ID }}
          project_name: ${{ secrets.CODEARTS_PROJECT_NAME }}
          repo_url: ${{ secrets.CODEARTS_REPO_URL }}
          branch: main
          task_name: maven-demo-main-check
          repo_type: GitHub
          rule_language: Java
          report_repo: Jo-joker/maven-demo
          report_dir: analyze
          github_token: ${{ secrets.REPORT_REPO_TOKEN }}
```

## Notes

- Creating a task on every run may fail if your project enforces unique task names. Use dynamic `task_name` or adjust your task management strategy.
- Ensure the CodeArts account has permissions to create and execute tasks and read reports.
- Ensure `github_token` can write to the target report repository.