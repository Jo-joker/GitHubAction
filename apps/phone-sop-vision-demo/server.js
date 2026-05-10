#!/usr/bin/env node
"use strict";

const http = require("node:http");
const { spawn } = require("node:child_process");

const APP_NAME = "AI 视觉 SOP 合规检测系统";
const DEFAULT_PORT = 4788;
const DEFAULT_HOST = "127.0.0.1";

const SOP_STEPS = [
  {
    id: 1,
    name: "正面",
    requiredObjects: ["product_front"],
    failedMessage: "本次操作未按照SOP规范检测",
  },
  {
    id: 2,
    name: "反面",
    requiredObjects: ["product_back"],
    failedMessage: "本次操作未按照SOP规范检测",
  },
  {
    id: 3,
    name: "整体",
    requiredObjects: ["product_whole"],
    failedMessage: "由于正面（反面）检测操作不符合SOP规范，请重新检测。",
  },
];

function parseArgs(argv) {
  const options = {
    host: process.env.SOP_DEMO_HOST || DEFAULT_HOST,
    port: Number.parseInt(process.env.SOP_DEMO_PORT || "", 10) || DEFAULT_PORT,
    open: process.env.SOP_DEMO_OPEN !== "0",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--no-open") {
      options.open = false;
    } else if (arg === "--host") {
      options.host = argv[++i] || options.host;
    } else if (arg.startsWith("--host=")) {
      options.host = arg.slice("--host=".length);
    } else if (arg === "--port") {
      options.port = Number.parseInt(argv[++i] || "", 10) || options.port;
    } else if (arg.startsWith("--port=")) {
      options.port = Number.parseInt(arg.slice("--port=".length), 10) || options.port;
    }
  }

  return options;
}

function printHelp() {
  console.log(`${APP_NAME}

Usage:
  sop-vision-demo [--host 127.0.0.1] [--port 4788] [--no-open]

Options:
  --host <host>   Bind address. Default: ${DEFAULT_HOST}
  --port <port>   Bind port. Default: ${DEFAULT_PORT}
  --no-open       Do not attempt to open the browser automatically.
  --help, -h      Show this help.

After startup, open the printed local URL in a browser to run the demo.`);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-store",
  });
  response.end(html);
}

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://localhost");

    if (url.pathname === "/" || url.pathname === "/index.html") {
      sendHtml(response, INDEX_HTML);
      return;
    }

    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        name: APP_NAME,
        version: "2.0.0",
        mode: "three-step-sop-demo",
      });
      return;
    }

    if (url.pathname === "/api/design") {
      sendJson(response, 200, {
        project: "产品三步检测SOP",
        statuses: ["Idle", "Running", "Pass", "Failed"],
        steps: SOP_STEPS,
        messages: {
          frontOrBackFailed: "本次操作未按照SOP规范检测",
          overallPreconditionFailed: "由于正面（反面）检测操作不符合SOP规范，请重新检测。",
        },
      });
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: "Not found",
    });
  });
}

function openBrowser(url) {
  const platform = process.platform;
  let command;
  let args;

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {});
  child.unref();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const server = createServer();
  server.on("error", (error) => {
    console.error(`启动失败：${error.message}`);
    process.exitCode = 1;
  });
  server.listen(options.port, options.host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;
    const url = `http://${options.host}:${port}`;
    console.log(`${APP_NAME} 已启动`);
    console.log(`本地访问地址: ${url}`);
    console.log("按 Ctrl+C 退出。");

    if (options.open && !process.env.CI) {
      openBrowser(url);
    }
  });
}

const INDEX_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI 视觉 SOP 合规检测系统</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: rgba(7, 17, 31, 0.88);
      --panel-2: rgba(16, 36, 62, 0.82);
      --line: #24486d;
      --cyan: #38d5ff;
      --green: #26d07c;
      --blue: #3c8dff;
      --red: #ff5c6c;
      --yellow: #f2c94c;
      --muted: #92abc4;
      --text: #e9f6ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top right, rgba(56, 213, 255, 0.18), transparent 34%),
        linear-gradient(135deg, #06101e 0%, #07192c 50%, #030712 100%);
    }
    .app { width: min(1480px, 100vw); margin: 0 auto; padding: 14px; }
    .topbar {
      display: grid;
      grid-template-columns: minmax(300px, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(12, 27, 47, 0.9);
      box-shadow: 0 0 20px rgba(56, 213, 255, 0.10) inset;
      margin-bottom: 12px;
    }
    .title { display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; font-weight: 800; }
    .title small { color: var(--muted); font-weight: 500; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .chip {
      border: 1px solid var(--line);
      background: #07182c;
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .chip strong { color: var(--text); }
    .chip.pass strong { color: var(--green); }
    .chip.failed strong { color: var(--red); }
    .grid {
      display: grid;
      grid-template-columns: minmax(620px, 1.35fr) minmax(420px, 0.9fr);
      gap: 12px;
    }
    .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 12px;
      overflow: hidden;
      min-width: 0;
    }
    .panel-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 40px;
      padding: 0 12px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(90deg, rgba(56, 213, 255, 0.12), transparent);
      color: var(--cyan);
      font-weight: 800;
      font-size: 14px;
    }
    .video-wrap { padding: 12px; }
    canvas {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 1px solid #1c4266;
      background: #111;
      border-radius: 8px;
    }
    .legend { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; color: var(--muted); font-size: 12px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 5px; }
    .right { display: grid; grid-template-rows: auto minmax(230px, 1fr) auto; gap: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid rgba(36, 72, 109, 0.82); padding: 10px 9px; text-align: left; }
    th { color: #abd8ff; background: rgba(60, 141, 255, 0.12); font-weight: 800; }
    tr.pass { background: rgba(38, 208, 124, 0.27); }
    tr.running { background: rgba(60, 141, 255, 0.27); }
    tr.failed { background: rgba(255, 92, 108, 0.24); }
    .status-pill {
      display: inline-block;
      min-width: 76px;
      padding: 4px 8px;
      border-radius: 999px;
      text-align: center;
      border: 1px solid var(--line);
      color: var(--muted);
      background: #08182b;
      font-size: 12px;
      font-weight: 800;
    }
    .status-pill.pass { color: #062012; background: var(--green); border-color: var(--green); }
    .status-pill.running { color: #fff; background: var(--blue); border-color: var(--blue); }
    .status-pill.failed { color: #fff; background: var(--red); border-color: var(--red); }
    .log {
      min-height: 210px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #bcebd8;
      line-height: 1.75;
      white-space: pre-wrap;
      overflow: auto;
      font-size: 13px;
    }
    .alert {
      display: none;
      margin: 0 12px 12px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(255, 92, 108, 0.72);
      background: rgba(255, 92, 108, 0.14);
      color: #ffd7dc;
      font-weight: 800;
    }
    .alert.visible { display: block; }
    .controls {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--line);
    }
    button, select {
      border: 1px solid var(--line);
      background: #0b2038;
      color: var(--text);
      border-radius: 9px;
      padding: 10px 11px;
      cursor: pointer;
      font-weight: 800;
    }
    button:hover, select:hover { border-color: var(--cyan); }
    button.primary { background: linear-gradient(135deg, #1260d6, #0aa0c7); border-color: #36c9ff; }
    button.warn { background: linear-gradient(135deg, #7d4410, #9f7816); border-color: var(--yellow); }
    .hint { color: var(--muted); font-size: 13px; padding: 0 12px 12px; line-height: 1.7; }
    .steps-bar {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .step-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      background: rgba(9, 26, 46, 0.92);
      min-height: 84px;
    }
    .step-card .name { font-weight: 800; margin-bottom: 8px; }
    .step-card.pass { border-color: var(--green); box-shadow: 0 0 0 1px rgba(38, 208, 124, 0.25) inset; }
    .step-card.running { border-color: var(--blue); box-shadow: 0 0 0 1px rgba(60, 141, 255, 0.35) inset; }
    .step-card.failed { border-color: var(--red); box-shadow: 0 0 0 1px rgba(255, 92, 108, 0.35) inset; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--line);
    }
    .metric { border: 1px solid rgba(36, 72, 109, 0.9); border-radius: 10px; padding: 10px; background: var(--panel-2); }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; font-size: 22px; margin-top: 4px; }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr; }
      .controls { grid-template-columns: 1fr 1fr; }
      .steps-bar { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="topbar">
      <div class="title">
        <span>AI 视觉 SOP 合规检测系统</span>
        <small>正面 / 反面 / 整体 · Idle / Running / Pass / Failed</small>
      </div>
      <div class="chips">
        <span class="chip">项目：<strong>产品三步检测SOP</strong></span>
        <span class="chip">作业员：<strong>张三</strong></span>
        <span class="chip">场景：<strong id="modeText">正常检测</strong></span>
        <span class="chip">耗时：<strong id="elapsedText">00:00</strong></span>
        <span class="chip" id="resultChip">最终结果：<strong id="resultText">Idle</strong></span>
      </div>
    </section>

    <section class="grid">
      <section class="panel">
        <div class="panel-title">
          <span>实时检测画面</span>
          <span id="frameInfo">FPS 0 · 推理 0ms</span>
        </div>
        <div class="video-wrap">
          <canvas id="scene" width="1280" height="720"></canvas>
          <div class="legend">
            <span><i class="dot" style="background:#38d5ff"></i>ROI</span>
            <span><i class="dot" style="background:#26d07c"></i>Pass 检测框</span>
            <span><i class="dot" style="background:#3c8dff"></i>Running 检测框</span>
            <span><i class="dot" style="background:#ff5c6c"></i>Failed 告警</span>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><span>检测目标</span><strong id="metricObjects">0</strong></div>
          <div class="metric"><span>当前步骤</span><strong id="metricStep">-</strong></div>
          <div class="metric"><span>Pass 步骤</span><strong id="metricPass">0/3</strong></div>
          <div class="metric"><span>稳定帧</span><strong id="metricStable">0</strong></div>
        </div>
      </section>

      <section class="right">
        <section class="panel">
          <div class="panel-title">SOP步骤状态</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">No</th>
                <th>步骤</th>
                <th style="width:95px">状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody id="stepsTable"></tbody>
          </table>
        </section>

        <section class="panel">
          <div class="panel-title">当前步骤 / 检测日志</div>
          <div class="log" id="logPanel"></div>
          <div class="alert" id="alertPanel"></div>
        </section>

        <section class="panel">
          <div class="panel-title">演示控制</div>
          <div class="controls">
            <button class="primary" id="startBtn">开始检测</button>
            <button id="pauseBtn">暂停</button>
            <button id="resetBtn">重置</button>
            <select id="scenarioSelect" title="演示场景">
              <option value="normal">正常检测</option>
              <option value="frontFailed">正面失败</option>
              <option value="backFailed">反面失败</option>
              <option value="overallFailed">整体失败</option>
            </select>
            <button class="warn" id="exportBtn">导出记录</button>
          </div>
          <p class="hint">
            说明：该演示包按照最新设计文档实现三步 SOP 状态机。生产环境可将模拟检测流替换为真实摄像头和 AI 推理结果。
          </p>
        </section>
      </section>

      <section class="steps-bar" id="stepsBar"></section>
    </section>
  </main>

  <script>
    const canvas = document.getElementById("scene");
    const ctx = canvas.getContext("2d");
    const stepsTable = document.getElementById("stepsTable");
    const stepsBar = document.getElementById("stepsBar");
    const logPanel = document.getElementById("logPanel");
    const alertPanel = document.getElementById("alertPanel");
    const modeText = document.getElementById("modeText");
    const elapsedText = document.getElementById("elapsedText");
    const resultText = document.getElementById("resultText");
    const resultChip = document.getElementById("resultChip");
    const frameInfo = document.getElementById("frameInfo");
    const metricObjects = document.getElementById("metricObjects");
    const metricStep = document.getElementById("metricStep");
    const metricPass = document.getElementById("metricPass");
    const metricStable = document.getElementById("metricStable");
    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const resetBtn = document.getElementById("resetBtn");
    const exportBtn = document.getElementById("exportBtn");
    const scenarioSelect = document.getElementById("scenarioSelect");

    const FRONT_BACK_FAILED_MESSAGE = "本次操作未按照SOP规范检测";
    const OVERALL_PRECONDITION_MESSAGE = "由于正面（反面）检测操作不符合SOP规范，请重新检测。";

    const STEPS = [
      { id: 1, name: "正面", required: ["product_front"], failedMessage: FRONT_BACK_FAILED_MESSAGE },
      { id: 2, name: "反面", required: ["product_back"], failedMessage: FRONT_BACK_FAILED_MESSAGE },
      { id: 3, name: "整体", required: ["product_whole"], failedMessage: OVERALL_PRECONDITION_MESSAGE },
    ];

    const LABELS = {
      product_front: "产品正面",
      product_back: "产品反面",
      product_whole: "产品整体",
      left_hand: "Left Hand",
      right_hand: "Right Hand",
    };

    const state = {
      running: false,
      paused: false,
      startedAt: 0,
      pausedAt: 0,
      pauseTotal: 0,
      scenario: "normal",
      currentIndex: 0,
      stepStartedAt: 0,
      stableFrames: 0,
      result: "Idle",
      alert: "",
      records: [],
      detections: [],
      lastFrame: performance.now(),
      fps: 0,
      steps: [],
    };

    function initialSteps() {
      return STEPS.map((step) => ({
        ...step,
        status: "Idle",
        note: "未开始检测",
        duration: 0,
      }));
    }

    function elapsedSeconds() {
      if (!state.running && state.startedAt === 0) return 0;
      const now = state.paused ? state.pausedAt : performance.now();
      return Math.max(0, (now - state.startedAt - state.pauseTotal) / 1000);
    }

    function formatTime(seconds) {
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
      return mm + ":" + ss;
    }

    function scenarioName(value) {
      return value === "frontFailed" ? "正面失败"
        : value === "backFailed" ? "反面失败"
        : value === "overallFailed" ? "整体失败"
        : "正常检测";
    }

    function start() {
      if (state.running && state.paused) {
        state.pauseTotal += performance.now() - state.pausedAt;
        state.paused = false;
        pauseBtn.textContent = "暂停";
        return;
      }
      state.running = true;
      state.paused = false;
      state.startedAt = performance.now();
      state.pausedAt = 0;
      state.pauseTotal = 0;
      state.currentIndex = 0;
      state.stepStartedAt = 0;
      state.stableFrames = 0;
      state.result = "Running";
      state.alert = "";
      state.records = [];
      state.steps = initialSteps();
      state.steps[0].status = "Running";
      state.steps[0].note = "正在检测";
      startBtn.textContent = "继续检测";
      pauseBtn.textContent = "暂停";
    }

    function pause() {
      if (!state.running) return;
      state.paused = !state.paused;
      if (state.paused) {
        state.pausedAt = performance.now();
        pauseBtn.textContent = "继续";
      } else {
        state.pauseTotal += performance.now() - state.pausedAt;
        pauseBtn.textContent = "暂停";
      }
    }

    function reset() {
      state.running = false;
      state.paused = false;
      state.startedAt = 0;
      state.pausedAt = 0;
      state.pauseTotal = 0;
      state.currentIndex = 0;
      state.stepStartedAt = 0;
      state.stableFrames = 0;
      state.result = "Idle";
      state.alert = "";
      state.records = [];
      state.detections = [];
      state.steps = initialSteps();
      startBtn.textContent = "开始检测";
      pauseBtn.textContent = "暂停";
    }

    function setScenario(value) {
      state.scenario = value;
      modeText.textContent = scenarioName(value);
      reset();
    }

    function detection(className, x, y, w, h, confidence) {
      return { className, x, y, w, h, confidence };
    }

    function hasFailedPrecondition() {
      return state.steps[0].status === "Failed" || state.steps[1].status === "Failed";
    }

    function overallPreconditionMessage() {
      const frontFailed = state.steps[0].status === "Failed";
      const backFailed = state.steps[1].status === "Failed";
      if (frontFailed && backFailed) return OVERALL_PRECONDITION_MESSAGE;
      if (frontFailed) return "由于正面检测操作不符合SOP规范，请重新检测。";
      if (backFailed) return "由于反面检测操作不符合SOP规范，请重新检测。";
      return "";
    }

    function recordStep(step, atSeconds) {
      state.records.push({
        at: Number(atSeconds.toFixed(2)),
        step: step.name,
        status: step.status,
        message: step.note,
        detections: state.detections.map((item) => ({
          className: item.className,
          confidence: Number(item.confidence.toFixed(2)),
        })),
      });
    }

    function failCurrentStep(message, atSeconds) {
      const step = state.steps[state.currentIndex];
      if (!step) return;
      step.status = "Failed";
      step.note = message;
      step.duration = Math.max(0, atSeconds - state.stepStartedAt);
      state.result = "Failed";
      state.alert = message;
      recordStep(step, atSeconds);

      if (step.id === 1 || step.id === 2) {
        const overall = state.steps[2];
        overall.status = "Failed";
        overall.note = overallPreconditionMessage() || OVERALL_PRECONDITION_MESSAGE;
        overall.duration = 0;
        state.alert = overall.note;
        state.records.push({
          at: Number(atSeconds.toFixed(2)),
          step: overall.name,
          status: overall.status,
          message: overall.note,
          detections: [],
        });
      }

      state.running = false;
    }

    function passCurrentStep(atSeconds) {
      const step = state.steps[state.currentIndex];
      step.status = "Pass";
      step.note = "检测成功";
      step.duration = Math.max(0, atSeconds - state.stepStartedAt);
      recordStep(step, atSeconds);
      state.currentIndex += 1;
      state.stableFrames = 0;
      state.stepStartedAt = atSeconds;

      if (state.currentIndex >= state.steps.length) {
        state.result = "Pass";
        state.running = false;
        return;
      }

      state.steps[state.currentIndex].status = "Running";
      state.steps[state.currentIndex].note = "正在检测";
      state.result = "Running";
    }

    function getScenarioFailureTime(stepId) {
      if (state.scenario === "frontFailed" && stepId === 1) return 2.7;
      if (state.scenario === "backFailed" && stepId === 2) return 2.7;
      if (state.scenario === "overallFailed" && stepId === 3) return 2.7;
      return null;
    }

    function getStepElapsed(nowSeconds) {
      return Math.max(0, nowSeconds - state.stepStartedAt);
    }

    function updateState(nowSeconds) {
      if (!state.running || state.paused) return;
      if (state.stepStartedAt === 0) {
        state.stepStartedAt = nowSeconds;
      }
      const step = state.steps[state.currentIndex];
      if (!step) return;

      if (step.id === 3 && hasFailedPrecondition()) {
        failCurrentStep(overallPreconditionMessage() || OVERALL_PRECONDITION_MESSAGE, nowSeconds);
        return;
      }

      const stepElapsed = getStepElapsed(nowSeconds);
      const failureTime = getScenarioFailureTime(step.id);
      if (failureTime !== null && stepElapsed >= failureTime) {
        failCurrentStep(step.failedMessage, nowSeconds);
        return;
      }

      const classSet = new Set(state.detections.map((item) => item.className));
      const satisfied = step.required.every((className) => classSet.has(className));
      const hasHand = classSet.has("left_hand") || classSet.has("right_hand");
      if (satisfied && hasHand) {
        state.stableFrames += 1;
      } else {
        state.stableFrames = Math.max(0, state.stableFrames - 1);
      }

      if (state.stableFrames >= 22) {
        passCurrentStep(nowSeconds);
      }
    }

    function getDetections(t) {
      if (!state.running && state.result === "Idle") return [];
      const step = state.steps[state.currentIndex] || state.steps[state.steps.length - 1];
      const stepElapsed = getStepElapsed(t);
      const jitter = Math.sin(t * 3) * 5;
      const detections = [];

      detections.push(detection("left_hand", 300 + jitter, 375 + Math.sin(t) * 8, 150, 180, 0.93));
      detections.push(detection("right_hand", 820 - jitter, 370 + Math.cos(t) * 8, 155, 185, 0.92));

      if (step && step.status === "Running") {
        if (step.id === 1) {
          detections.push(detection("product_front", 485, 250, 310, 210, stepElapsed < 1.0 ? 0.72 : 0.94));
        } else if (step.id === 2) {
          detections.push(detection("product_back", 485, 250, 310, 210, stepElapsed < 1.0 ? 0.73 : 0.93));
        } else if (step.id === 3) {
          detections.push(detection("product_whole", 430, 225, 420, 260, stepElapsed < 1.0 ? 0.76 : 0.95));
        }
      } else if (state.result === "Pass") {
        detections.push(detection("product_whole", 430, 225, 420, 260, 0.96));
      }
      return detections;
    }

    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#9f7445");
      gradient.addColorStop(0.45, "#bd8c55");
      gradient.addColorStop(1, "#77512d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#111827";
      ctx.fillRect(220, 24, 650, 78);
      ctx.fillStyle = "#0a0f1b";
      for (let i = 0; i < 26; i += 1) {
        ctx.fillRect(238 + i * 23, 40, 16, 14);
        ctx.fillRect(238 + i * 23, 64, 16, 14);
      }

      ctx.strokeStyle = "rgba(56, 213, 255, 0.92)";
      ctx.lineWidth = 3;
      ctx.strokeRect(150, 150, 900, 450);
      ctx.fillStyle = "rgba(56, 213, 255, 0.08)";
      ctx.fillRect(150, 150, 900, 450);
      ctx.fillStyle = "#7de7ff";
      ctx.font = "18px sans-serif";
      ctx.fillText("ROI 产品检测区域", 164, 180);
    }

    function drawProduct(t) {
      const step = state.steps[state.currentIndex] || {};
      const status = step.status;
      const activeStepId = status === "Running" ? step.id : state.result === "Pass" ? 3 : 0;
      const x = activeStepId === 3 ? 430 : 485;
      const y = activeStepId === 3 ? 225 : 250;
      const w = activeStepId === 3 ? 420 : 310;
      const h = activeStepId === 3 ? 260 : 210;

      if (!activeStepId) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
        ctx.beginPath();
        ctx.roundRect(460, 250, 360, 220, 18);
        ctx.fill();
        ctx.fillStyle = "#7de7ff";
        ctx.font = "28px sans-serif";
        ctx.fillText("等待开始检测", 545, 370);
        return;
      }

      ctx.fillStyle = activeStepId === 1 ? "#172554" : activeStepId === 2 ? "#1f2937" : "#0f172a";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 24);
      ctx.fill();
      ctx.fillStyle = activeStepId === 1 ? "#60a5fa" : activeStepId === 2 ? "#94a3b8" : "#b7e9ff";
      ctx.font = "34px sans-serif";
      const label = activeStepId === 1 ? "产品正面" : activeStepId === 2 ? "产品反面" : "产品整体";
      ctx.fillText(label, x + w / 2 - 68, y + h / 2 + 10);

      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 28, y + 34, w - 56, 18);
      ctx.fillRect(x + 28, y + h - 54, w - 56, 18);
    }

    function drawHand(det, color) {
      ctx.save();
      ctx.fillStyle = "rgba(245, 213, 186, 0.9)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(det.x, det.y, det.w, det.h, 48);
      ctx.fill();
      ctx.stroke();

      const cx = det.x + det.w * 0.5;
      const cy = det.y + det.h * 0.24;
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i += 1) {
        const x = det.x + 24 + i * (det.w - 48) / 4;
        const y = det.y + 24 + Math.sin(i) * 8;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 45);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawDetections(detections) {
      detections.forEach((det) => {
        const isHand = det.className === "left_hand" || det.className === "right_hand";
        const color = state.result === "Failed" ? "#ff5c6c" : det.confidence < 0.8 ? "#f2c94c" : "#26d07c";
        if (isHand) drawHand(det, color);

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(det.x, det.y, det.w, det.h);
        ctx.fillStyle = color;
        ctx.font = "18px sans-serif";
        const label = (LABELS[det.className] || det.className) + " " + det.confidence.toFixed(2);
        const textWidth = ctx.measureText(label).width + 12;
        ctx.fillRect(det.x, det.y - 24, textWidth, 24);
        ctx.fillStyle = "#04111f";
        ctx.fillText(label, det.x + 6, det.y - 6);
      });
    }

    function renderScene(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      drawProduct(t);
      drawDetections(state.detections);

      if (state.alert) {
        ctx.fillStyle = "rgba(255, 92, 108, 0.88)";
        ctx.fillRect(150, 612, 900, 58);
        ctx.fillStyle = "#fff";
        ctx.font = "24px sans-serif";
        ctx.fillText(state.alert, 170, 648);
      }
    }

    function renderUI(t) {
      elapsedText.textContent = formatTime(t);
      resultText.textContent = state.result;
      resultChip.className = "chip " + state.result.toLowerCase();

      stepsTable.innerHTML = state.steps.map((step) => {
        const rowClass = step.status.toLowerCase();
        return "<tr class='" + rowClass + "'><td>" + step.id + "</td><td>" + step.name + "</td><td><span class='status-pill " + rowClass + "'>" + step.status + "</span></td><td>" + step.note + "</td></tr>";
      }).join("");

      stepsBar.innerHTML = state.steps.map((step) => {
        const cls = step.status.toLowerCase();
        return "<div class='step-card " + cls + "'><div class='name'>" + step.id + ". " + step.name + "</div><span class='status-pill " + cls + "'>" + step.status + "</span><div class='hint' style='padding:8px 0 0'>" + step.note + "</div></div>";
      }).join("");

      const current = state.steps[state.currentIndex] || state.steps[state.steps.length - 1];
      const inferMs = Math.max(18, Math.round(32 + Math.sin(t * 2) * 8 + state.detections.length * 2));
      const counts = state.detections.reduce((acc, item) => {
        acc[item.className] = (acc[item.className] || 0) + 1;
        return acc;
      }, {});
      const validTargets = Object.keys(counts).map((key) => (LABELS[key] || key) + counts[key]).join("，") || "无";
      const passCount = state.steps.filter((step) => step.status === "Pass").length;

      frameInfo.textContent = "FPS " + state.fps.toFixed(0) + " · 推理 " + inferMs + "ms";
      metricObjects.textContent = String(state.detections.length);
      metricStep.textContent = current ? current.name : "-";
      metricPass.textContent = passCount + "/3";
      metricStable.textContent = String(state.stableFrames);
      alertPanel.textContent = state.alert;
      alertPanel.className = "alert " + (state.alert ? "visible" : "");

      logPanel.textContent = [
        "当前步骤：" + (current ? current.name : "全部完成"),
        "当前状态：" + state.result,
        "检测数量：" + state.detections.length,
        "检测耗时：" + inferMs + "ms",
        "有效目标：" + validTargets,
        "稳定帧数：" + state.stableFrames,
        "失败提示：" + (state.alert || "无"),
        "最终结果：" + state.result,
      ].join("\\n");
    }

    function tick(now) {
      const delta = now - state.lastFrame;
      state.lastFrame = now;
      state.fps = state.fps * 0.9 + (1000 / Math.max(1, delta)) * 0.1;
      const t = elapsedSeconds();
      state.detections = getDetections(t);
      updateState(t);
      renderScene(t);
      renderUI(t);
      requestAnimationFrame(tick);
    }

    function exportRecord() {
      const payload = {
        project: "产品三步检测SOP",
        operator: "张三",
        scenario: state.scenario,
        result: state.result,
        failedMessage: state.alert,
        durationSeconds: Number(elapsedSeconds().toFixed(2)),
        steps: state.steps.map((step) => ({
          id: step.id,
          name: step.name,
          status: step.status,
          message: step.note,
          duration: Number((step.duration || 0).toFixed(2)),
        })),
        events: state.records,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "three-step-sop-detection-record.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + width, y, x + width, y + height, r);
        this.arcTo(x + width, y + height, x, y + height, r);
        this.arcTo(x, y + height, x, y, r);
        this.arcTo(x, y, x + width, y, r);
        this.closePath();
        return this;
      };
    }

    startBtn.addEventListener("click", start);
    pauseBtn.addEventListener("click", pause);
    resetBtn.addEventListener("click", reset);
    exportBtn.addEventListener("click", exportRecord);
    scenarioSelect.addEventListener("change", (event) => setScenario(event.target.value));

    reset();
    requestAnimationFrame(tick);
  </script>
</body>
</html>`;

main();
