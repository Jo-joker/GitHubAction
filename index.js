const core = {
  getInput(name, options = {}) {
    const key = `INPUT_${String(name).replace(/ /g, "_").toUpperCase()}`;
    const value = process.env[key] ?? "";
    if (options.required && !value.trim()) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value.trim();
  },
  setOutput(name, value) {
    const line = `${name}=${escapeCommandValue(value)}`;
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      require("node:fs").appendFileSync(outputFile, `${line}\n`, "utf8");
      return;
    }
    process.stdout.write(`::set-output name=${name}::${escapeCommandValue(value)}\n`);
  },
  setFailed(message) {
    process.exitCode = 1;
    process.stdout.write(`::error::${escapeCommandValue(message)}\n`);
  },
  info(message) {
    process.stdout.write(`${String(message)}\n`);
  },
  warning(message) {
    process.stdout.write(`::warning::${escapeCommandValue(message)}\n`);
  },
};

function escapeCommandValue(value) {
  return String(value ?? "")
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

function normalizeEndpoint(endpoint) {
  return endpoint.replace(/\/+$/, "");
}

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).trim().toLowerCase() === "true";
}

function asInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function encodeBase64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

function decodeBase64(str) {
  return Buffer.from(str, "base64").toString("utf8");
}

async function requestJson(url, options = {}, expectedStatuses = [200]) {
  core.info(`show url ${url}`);
  const response = await fetch(url, options);
  core.info(`fetch repo sueccessful`);
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON from ${url}: ${error.message}. Raw body: ${text}`);
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const errorCode = body.error_code ? ` (${body.error_code})` : "";
    const errorMsg = body.error_msg ? `: ${body.error_msg}` : "";
    throw new Error(`Request failed ${response.status} ${response.statusText}${errorCode}${errorMsg} on ${url}`);
  }

  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

async function obtainIamToken(iamEndpoint, username, password, domainName, projectName) {
  const endpoint = normalizeEndpoint(iamEndpoint);
  const url = `${endpoint}/v3/auth/tokens`;

  const payload = {
    auth: {
      identity: {
        methods: ["password"],
        password: {
          user: {
            name: username,
            password,
            domain: {
              name: domainName,
            },
          },
        },
      },
      scope: {
        project: {
          name: projectName,
        },
      },
    },
  };

  const response = await requestJson(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    [201]
  );

  const token = response.headers.get("x-subject-token");
  if (!token) {
    throw new Error("IAM token request succeeded but x-subject-token header is missing.");
  }
  return token;
}

function buildTaskPayload(inputs) {
  const configTemplate = {
    repo_type: inputs.repoType,
    branch: inputs.branch,
    rule_sets: [
      {
        language: inputs.ruleLanguage,
      },
    ],
    project_id: inputs.projectId,
    project_name: inputs.projectName,
  };

  if (inputs.authId) {
    configTemplate.authId = inputs.authId;
  }
  if (inputs.authType) {
    configTemplate.authType = inputs.authType;
  }
  core.info(`show repoUrl: ${inputs.repoUrl}`);
  return {
    repo_url: inputs.repoUrl,
    branch: inputs.branch,
    name: inputs.taskName,
    config_template: configTemplate,
    project_id: inputs.projectId,
    project_name: inputs.projectName,
  };
}

async function createTask(baseEndpoint, token, inputs) {
  const url = `${baseEndpoint}/v3/task`;
  const payload = buildTaskPayload(inputs);
  core.info(`build TaskPayload seuccessful`);
  core.info(`show payload ${payload}`);
  const response = await requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": token,
    },
    body: JSON.stringify(payload),
  });
  core.info(`create task sueccessful`);
  const taskId = response.body?.result?.id;
  if (!taskId) {
    throw new Error(`Create task succeeded but task id not found. Response: ${JSON.stringify(response.body)}`);
  }
  return taskId;
}

async function runTask(baseEndpoint, token, taskId, runRef) {
  const url = `${baseEndpoint}/v2/tasks/${encodeURIComponent(taskId)}/run`;
  const payload = {};
  if (runRef) {
    payload.ref = runRef;
  }

  const response = await requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": token,
    },
    body: JSON.stringify(payload),
  });

  const execId = response.body?.exec_id;
  if (!execId) {
    throw new Error(`Run task succeeded but exec_id not found. Response: ${JSON.stringify(response.body)}`);
  }
  return execId;
}

async function getJobs(baseEndpoint, token, taskId, page = 1, pageSize = 200) {
  const url = `${baseEndpoint}/v4/tasks/${encodeURIComponent(taskId)}/jobs?page=${page}&page_size=${pageSize}`;
  const response = await requestJson(url, {
    headers: {
      "X-Auth-Token": token,
    },
  });
  return response.body;
}

function mapJobStatusToResult(status) {
  if (status === "success") {
    return "success";
  }
  if (status === "failed" || status === "aborted") {
    return "failure";
  }
  return null;
}

async function waitForJobCompletion(baseEndpoint, token, taskId, execId, timeoutSeconds, pollIntervalSeconds) {
  const timeoutMs = timeoutSeconds * 1000;
  const intervalMs = pollIntervalSeconds * 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const jobsData = await getJobs(baseEndpoint, token, taskId);
    const jobs = Array.isArray(jobsData.data) ? jobsData.data : [];
    const matched = jobs.find((job) => job.id === execId);

    if (matched) {
      core.info(`Current job status: ${matched.status}`);
      const result = mapJobStatusToResult(matched.status);
      if (result) {
        return matched;
      }
    } else {
      core.info("Execution record not visible yet, continue polling.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutSeconds}s waiting for execution ${execId}.`);
}

async function getSummary(baseEndpoint, token, taskId, execId) {
  const url = `${baseEndpoint}/v2/tasks/${encodeURIComponent(taskId)}/defects-summary?job_id=${encodeURIComponent(execId)}`;
  const response = await requestJson(url, {
    headers: {
      "X-Auth-Token": token,
    },
  });
  return response.body;
}

async function getDefectsPage(baseEndpoint, token, taskId, options) {
  const params = new URLSearchParams();
  params.set("offset", String(options.offset));
  params.set("limit", String(options.limit));
  if (options.statusIds) {
    params.set("status_ids", options.statusIds);
  }
  if (options.severity) {
    params.set("severity", options.severity);
  }

  const url = `${baseEndpoint}/v2/tasks/${encodeURIComponent(taskId)}/defects-detail?${params.toString()}`;
  const response = await requestJson(url, {
    headers: {
      "X-Auth-Token": token,
    },
  });
  return response.body;
}

function severityName(level) {
  switch (String(level)) {
    case "0":
      return "Critical";
    case "1":
      return "Major";
    case "2":
      return "Minor";
    case "3":
      return "Suggestion";
    default:
      return "Unknown";
  }
}

function statusName(status) {
  switch (String(status)) {
    case "0":
      return "Pending";
    case "1":
      return "Resolved";
    case "2":
      return "Ignored";
    default:
      return "Unknown";
  }
}

function escapeMdCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function utcTimestampCompact(date = new Date()) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}${pad(date.getUTCSeconds())}`;
}

function buildMarkdownReport(context) {
  const {
    taskId,
    execId,
    taskName,
    branch,
    repoUrl,
    ruleLanguage,
    projectId,
    projectName,
    summary,
    defects,
    generatedAt,
    runUrl,
    job,
  } = context;

  const lines = [];
  lines.push("# CodeArts Check Analysis Report");
  lines.push("");
  lines.push(`- Generated At (UTC): ${generatedAt}`);
  lines.push(`- GitHub Run: ${runUrl}`);
  lines.push(`- Project: ${projectName} (${projectId})`);
  lines.push(`- Task Name: ${taskName}`);
  lines.push(`- Task ID: ${taskId}`);
  lines.push(`- Execution ID: ${execId}`);
  lines.push(`- Repository: ${repoUrl}`);
  lines.push(`- Branch: ${branch}`);
  lines.push(`- Rule Language: ${ruleLanguage}`);
  lines.push(`- Execution Status: ${job.status}`);
  lines.push(`- Execution Start: ${job.startTime || "N/A"}`);
  lines.push(`- Execution Finish: ${job.finishTime || "N/A"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| issue_count | ${summary.issue_count ?? "N/A"} |`);
  lines.push(`| new_count | ${summary.new_count ?? "N/A"} |`);
  lines.push(`| solve_count | ${summary.solve_count ?? "N/A"} |`);
  lines.push(`| critical_count | ${summary.critical_count ?? "N/A"} |`);
  lines.push(`| major_count | ${summary.major_count ?? "N/A"} |`);
  lines.push(`| minor_count | ${summary.minor_count ?? "N/A"} |`);
  lines.push(`| suggestion_count | ${summary.suggestion_count ?? "N/A"} |`);
  lines.push(`| code_line | ${summary.code_line ?? "N/A"} |`);
  lines.push(`| code_line_total | ${summary.code_line_total ?? "N/A"} |`);
  lines.push(`| duplication_ratio | ${summary.duplication_ratio ?? "N/A"} |`);
  lines.push(`| file_duplication_ratio | ${summary.file_duplication_ratio ?? "N/A"} |`);
  lines.push(`| complexity_count | ${summary.complexity_count ?? "N/A"} |`);
  lines.push(`| risk_coefficient | ${summary.risk_coefficient ?? "N/A"} |`);
  lines.push(`| review_result | ${summary.review_result ?? "N/A"} |`);
  lines.push(`| is_access | ${summary.is_access ?? "N/A"} |`);
  lines.push("");
  lines.push("## Defects");
  lines.push("");
  lines.push(`Total defects ed: **${defects.length}**`);
  lines.push("");

  if (defects.length === 0) {
    lines.push("No defects matched the selected filter.");
    lines.push("");
  } else {
    lines.push("| # | Severity | Status | Rule | File | Line | Description |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    defects.forEach((defect, index) => {
      lines.push(
        `| ${index + 1} | ${severityName(defect.defect_level)} | ${statusName(defect.defect_status)} | ${escapeMdCell(
          defect.rule_name || defect.defect_checker_name
        )} | ${escapeMdCell(defect.file_path)} | ${escapeMdCell(defect.line_number)} | ${escapeMdCell(defect.defect_content)} |`
      );
    });
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function sanitizePathSegment(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseOwnerRepo(ownerRepo) {
  const parts = String(ownerRepo).split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid owner/repo format: ${ownerRepo}`);
  }
  return {
    owner: parts[0],
    repo: parts[1],
  };
}

async function githubRequestJson(url, token, options = {}, expectedStatuses = [200]) {
  return requestJson(
    url,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    },
    expectedStatuses
  );
}

async function getDefaultBranch(githubToken, owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const response = await githubRequestJson(url, githubToken);
  const branch = response.body?.default_branch;
  if (!branch) {
    throw new Error(`Cannot determine default branch for ${owner}/${repo}`);
  }
  return branch;
}

async function getFileShaIfExists(githubToken, owner, repo, path, branch) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(
    branch
  )}`;

  try {
    const response = await githubRequestJson(url, githubToken);
    return response.body?.sha;
  } catch (error) {
    if (error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

async function putFile(githubToken, owner, repo, path, branch, message, content, sha) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const payload = {
    message,
    content: encodeBase64(content),
    branch,
  };
  if (sha) {
    payload.sha = sha;
  }

  const response = await githubRequestJson(
    url,
    githubToken,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    [200, 201]
  );

  const contentInfo = response.body?.content;
  if (!contentInfo?.sha) {
    throw new Error(`GitHub upload succeeded but content SHA missing. Response: ${JSON.stringify(response.body)}`);
  }

  return {
    sha: contentInfo.sha,
    path: contentInfo.path,
    htmlUrl: contentInfo.html_url,
    downloadUrl: contentInfo.download_url,
    encodedContent: contentInfo.content,
  };
}

async function Defects(baseEndpoint, token, taskId, statusIds, maxDefects) {
  const defects = [];
  let offset = 0;
  const pageLimit = 200;

  while (defects.length < maxDefects) {
    const limit = Math.min(pageLimit, maxDefects - defects.length);
    const page = await getDefectsPage(baseEndpoint, token, taskId, {
      offset,
      limit,
      statusIds,
    });

    const pageDefects = Array.isArray(page.defects) ? page.defects : [];
    defects.push(...pageDefects);
    offset += limit;

    if (pageDefects.length === 0 || defects.length >= (page.total ?? Number.MAX_SAFE_INTEGER)) {
      break;
    }
  }

  return defects.slice(0, maxDefects);
}

async function run() {
  try {
    const inputs = {
      codeartsEndpoint: normalizeEndpoint(core.getInput("codearts_endpoint", { required: true })),
      codeartsToken: core.getInput("codearts_token"),
      iamEndpoint: core.getInput("iam_endpoint"),
      iamUsername: core.getInput("iam_username"),
      iamPassword: core.getInput("iam_password"),
      iamDomainName: core.getInput("iam_domain_name"),
      iamProjectName: core.getInput("iam_project_name"),
      projectId: core.getInput("project_id", { required: true }),
      projectName: core.getInput("project_name", { required: true }),
      repoUrl: core.getInput("repo_url", { required: true }),
      branch: core.getInput("branch", { required: true }),
      taskName: core.getInput("task_name", { required: true }),
      repoType: core.getInput("repo_type", { required: true }),
      ruleLanguage: core.getInput("rule_language", { required: true }),
      authId: core.getInput("auth_id"),
      authType: core.getInput("auth_type"),
      runRef: core.getInput("run_ref"),
      timeoutSeconds: asInteger(core.getInput("timeout_seconds"), 1800),
      pollIntervalSeconds: asInteger(core.getInput("poll_interval_seconds"), 15),
      includeStatusIds: core.getInput("include_status_ids"),
      maxDefects: asInteger(core.getInput("max_defects"), 500),
      reportRepo: core.getInput("report_repo"),
      reportDir: core.getInput("report_dir"),
      reportBranch: core.getInput("report_branch"),
      reportCommitMessage: core.getInput("report_commit_message"),
      githubToken: core.getInput("github_token", { required: true }),
      failOnJobFailure: asBoolean(core.getInput("fail_on_job_failure"), false),
    };

    let token = inputs.codeartsToken;
    if (!token) {
      if (!inputs.iamUsername || !inputs.iamPassword || !inputs.iamDomainName || !inputs.iamProjectName) {
        throw new Error(
          "codearts_token is empty. iam_username, iam_password, iam_domain_name, and iam_project_name are required for IAM token flow."
        );
      }
      core.info("Obtaining CodeArts token from IAM.");
      token = await obtainIamToken(
        inputs.iamEndpoint,
        inputs.iamUsername,
        inputs.iamPassword,
        inputs.iamDomainName,
        inputs.iamProjectName
      );
    }

    core.info("Creating CodeArts Check task.");
    const taskId = await createTask(inputs.codeartsEndpoint, token, inputs);
    core.setOutput("task_id", taskId);
    core.info(`Task created: ${taskId}`);

    core.info("Running task.");
    const execId = await runTask(inputs.codeartsEndpoint, token, taskId, inputs.runRef);
    core.setOutput("exec_id", execId);
    core.info(`Execution started: ${execId}`);

    core.info("Polling execution status.");
    const job = await waitForJobCompletion(
      inputs.codeartsEndpoint,
      token,
      taskId,
      execId,
      inputs.timeoutSeconds,
      inputs.pollIntervalSeconds
    );
    core.setOutput("job_status", job.status);
    core.info(`Execution completed with status: ${job.status}`);

    core.info("Querying summary and defects.");
    const summary = await getSummary(inputs.codeartsEndpoint, token, taskId, execId);
    const defects = await Defects(inputs.codeartsEndpoint, token, taskId, inputs.includeStatusIds, inputs.maxDefects);
    core.info(`ed defects: ${defects.length}`);

    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const markdown = buildMarkdownReport({
      taskId,
      execId,
      taskName: inputs.taskName,
      branch: inputs.branch,
      repoUrl: inputs.repoUrl,
      ruleLanguage: inputs.ruleLanguage,
      projectId: inputs.projectId,
      projectName: inputs.projectName,
      summary,
      defects,
      generatedAt: new Date().toISOString(),
      runUrl,
      job,
    });

    const { owner, repo } = parseOwnerRepo(inputs.reportRepo);
    const reportBranch = inputs.reportBranch || (await getDefaultBranch(inputs.githubToken, owner, repo));
    const reportFileName = `${utcTimestampCompact()}-${sanitizePathSegment(inputs.taskName)}-${sanitizePathSegment(execId)}.md`;
    const reportPath = `${inputs.reportDir.replace(/^\/+|\/+$/g, "")}/${reportFileName}`;

    core.info(`Uploading report to ${owner}/${repo}:${reportPath} on branch ${reportBranch}`);
    const existingSha = await getFileShaIfExists(inputs.githubToken, owner, repo, reportPath, reportBranch);
    const uploadResult = await putFile(
      inputs.githubToken,
      owner,
      repo,
      reportPath,
      reportBranch,
      `${inputs.reportCommitMessage} [task:${taskId} exec:${execId}]`,
      markdown,
      existingSha
    );

    // Verify write by comparing decoded response content when available.
    if (uploadResult.encodedContent) {
      const decoded = decodeBase64(uploadResult.encodedContent.replace(/\n/g, ""));
      if (decoded.trim() !== markdown.trim()) {
        core.warning("Uploaded content decoded from GitHub response does not exactly match local markdown.");
      }
    }

    core.setOutput("report_path", uploadResult.path);
    core.setOutput("report_url", uploadResult.htmlUrl || uploadResult.downloadUrl || "");
    core.setOutput("report_sha", uploadResult.sha);
    core.info(`Report uploaded successfully: ${uploadResult.path}`);

    if (inputs.failOnJobFailure && (job.status === "failed" || job.status === "aborted")) {
      core.setFailed(`CodeArts Check execution ended in status ${job.status}. Report was still uploaded.`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
