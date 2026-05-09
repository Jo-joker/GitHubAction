#!/usr/bin/env node
"use strict";

const http = require("node:http");
const { spawn } = require("node:child_process");

const APP_NAME = "手机检测与包装 AI 视觉 SOP 合规检测系统";
const DEFAULT_PORT = 4788;
const DEFAULT_HOST = "127.0.0.1";

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
        version: "1.0.0",
        mode: "standalone-demo",
      });
      return;
    }

    if (url.pathname === "/api/design") {
      sendJson(response, 200, {
        project: "手机检测与包装SOP",
        steps: [
          { id: 1, name: "开口空盒检测", requiredObjects: ["open_box"] },
          { id: 2, name: "放入手机并检测外观", requiredObjects: ["phone"] },
          { id: 3, name: "放入说明书/保修卡", requiredObjects: ["manual", "warranty_card"] },
          { id: 4, name: "放入充电线与配件", requiredObjects: ["cable", "sim_pin"] },
          { id: 5, name: "合盖封装", requiredObjects: ["closed_box"] },
        ],
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
  <title>手机检测与包装 AI 视觉 SOP 合规检测系统</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0c1b2f;
      --panel-2: #10243e;
      --line: #24486d;
      --cyan: #38d5ff;
      --green: #26d07c;
      --blue: #3c8dff;
      --yellow: #f2c94c;
      --red: #ff5c6c;
      --muted: #86a4bf;
      --text: #e9f6ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      background: radial-gradient(circle at top right, rgba(47, 136, 255, 0.20), transparent 36%),
                  linear-gradient(135deg, #06101e 0%, #07192c 46%, #030712 100%);
      color: var(--text);
      min-height: 100vh;
    }
    .app {
      width: min(1500px, 100vw);
      margin: 0 auto;
      padding: 14px;
    }
    .topbar {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--line);
      background: rgba(12, 27, 47, 0.86);
      box-shadow: 0 0 20px rgba(56, 213, 255, 0.10) inset;
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .title {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: baseline;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .title small { color: var(--muted); font-weight: 500; }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .chip {
      border: 1px solid var(--line);
      background: #07182c;
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .chip strong { color: var(--text); }
    .chip.ok strong { color: var(--green); }
    .chip.ng strong { color: var(--red); }
    .grid {
      display: grid;
      grid-template-columns: minmax(620px, 1.4fr) minmax(420px, 0.9fr);
      gap: 12px;
    }
    .panel {
      border: 1px solid var(--line);
      background: rgba(7, 17, 31, 0.86);
      border-radius: 12px;
      overflow: hidden;
      min-width: 0;
    }
    .panel-title {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      border-bottom: 1px solid var(--line);
      color: var(--cyan);
      background: linear-gradient(90deg, rgba(56, 213, 255, 0.12), transparent);
      font-size: 14px;
      font-weight: 700;
    }
    .video-wrap {
      position: relative;
      padding: 12px;
    }
    canvas {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 1px solid #1c4266;
      background: #111;
      border-radius: 8px;
    }
    .legend {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 5px;
    }
    .right {
      display: grid;
      grid-template-rows: auto minmax(210px, 1fr) auto;
      gap: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border-bottom: 1px solid rgba(36, 72, 109, 0.82);
      padding: 10px 9px;
      text-align: left;
    }
    th {
      color: #abd8ff;
      background: rgba(60, 141, 255, 0.12);
      font-weight: 700;
    }
    tr.done { background: rgba(38, 208, 124, 0.28); }
    tr.running { background: rgba(60, 141, 255, 0.27); }
    tr.ng { background: rgba(255, 92, 108, 0.24); }
    .status-pill {
      display: inline-block;
      min-width: 74px;
      padding: 4px 8px;
      border-radius: 999px;
      text-align: center;
      border: 1px solid var(--line);
      color: var(--muted);
      background: #08182b;
      font-size: 12px;
    }
    .status-pill.done { color: #062012; background: var(--green); border-color: var(--green); font-weight: 800; }
    .status-pill.running { color: white; background: var(--blue); border-color: var(--blue); font-weight: 800; }
    .status-pill.ng { color: white; background: var(--red); border-color: var(--red); font-weight: 800; }
    .log {
      min-height: 170px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #bcebd8;
      line-height: 1.75;
      white-space: pre-wrap;
      overflow: auto;
      font-size: 13px;
    }
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
      font-weight: 700;
    }
    button:hover, select:hover { border-color: var(--cyan); }
    button.primary { background: linear-gradient(135deg, #1260d6, #0aa0c7); border-color: #36c9ff; }
    button.warn { background: linear-gradient(135deg, #7d4410, #9f7816); border-color: var(--yellow); }
    button.danger { background: linear-gradient(135deg, #7f1826, #b72a3c); border-color: var(--red); }
    .steps-bar {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .step-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 11px;
      background: rgba(9, 26, 46, 0.92);
      min-height: 76px;
    }
    .step-card .name { font-weight: 700; margin-bottom: 8px; }
    .step-card.done { border-color: var(--green); box-shadow: 0 0 0 1px rgba(38, 208, 124, 0.25) inset; }
    .step-card.running { border-color: var(--blue); box-shadow: 0 0 0 1px rgba(60, 141, 255, 0.35) inset; }
    .step-card.ng { border-color: var(--red); box-shadow: 0 0 0 1px rgba(255, 92, 108, 0.35) inset; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--line);
    }
    .metric {
      border: 1px solid rgba(36, 72, 109, 0.9);
      border-radius: 10px;
      padding: 10px;
      background: rgba(16, 36, 62, 0.72);
    }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; font-size: 22px; margin-top: 4px; }
    .hint {
      color: var(--muted);
      font-size: 13px;
      padding: 0 12px 12px;
      line-height: 1.7;
    }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr; }
      .steps-bar { grid-template-columns: 1fr 1fr; }
      .controls { grid-template-columns: 1fr 1fr; }
      .metrics { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="topbar">
      <div class="title">
        <span>手机检测与包装 AI 视觉 SOP 合规检测系统</span>
        <small>Standalone Demo · 目标检测 + 手部关键点 + SOP 状态机</small>
      </div>
      <div class="chips">
        <span class="chip">项目：<strong>手机包装SOP</strong></span>
        <span class="chip">作业员：<strong>张三</strong></span>
        <span class="chip">模式：<strong id="modeText">正常顺序</strong></span>
        <span class="chip">耗时：<strong id="elapsedText">00:00</strong></span>
        <span class="chip" id="resultChip">结果：<strong id="resultText">待开始</strong></span>
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
            <span><i class="dot" style="background:#26d07c"></i>AI检测框</span>
            <span><i class="dot" style="background:#f2c94c"></i>低置信度目标</span>
            <span><i class="dot" style="background:#ff5c6c"></i>NG异常</span>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><span>检测目标</span><strong id="metricObjects">0</strong></div>
          <div class="metric"><span>当前步骤</span><strong id="metricStep">-</strong></div>
          <div class="metric"><span>完成步骤</span><strong id="metricDone">0/5</strong></div>
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
                <th style="width:95px">结果</th>
                <th style="width:120px">说明</th>
              </tr>
            </thead>
            <tbody id="stepsTable"></tbody>
          </table>
        </section>

        <section class="panel">
          <div class="panel-title">当前步骤 / 检测日志</div>
          <div class="log" id="logPanel"></div>
        </section>

        <section class="panel">
          <div class="panel-title">演示控制</div>
          <div class="controls">
            <button class="primary" id="startBtn">开始检测</button>
            <button id="pauseBtn">暂停</button>
            <button id="resetBtn">重置</button>
            <select id="scenarioSelect" title="演示场景">
              <option value="normal">正常顺序</option>
              <option value="skipDocs">异常：漏放说明书</option>
              <option value="wrongOrder">异常：手机提前放入</option>
            </select>
            <button class="warn" id="exportBtn">导出记录</button>
          </div>
          <p class="hint">
            说明：该演示包内置模拟 AI 检测流，用于复刻产品能力演示。生产环境可将前端接入真实摄像头和后端模型推理结果，保留同一套 SOP 状态机与 UI。
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
    const modeText = document.getElementById("modeText");
    const elapsedText = document.getElementById("elapsedText");
    const resultText = document.getElementById("resultText");
    const resultChip = document.getElementById("resultChip");
    const frameInfo = document.getElementById("frameInfo");
    const metricObjects = document.getElementById("metricObjects");
    const metricStep = document.getElementById("metricStep");
    const metricDone = document.getElementById("metricDone");
    const metricStable = document.getElementById("metricStable");
    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const resetBtn = document.getElementById("resetBtn");
    const exportBtn = document.getElementById("exportBtn");
    const scenarioSelect = document.getElementById("scenarioSelect");

    const STEPS = [
      { id: 1, name: "开口空盒检测", required: ["open_box"], timeout: 8 },
      { id: 2, name: "放入手机并检测外观", required: ["phone"], timeout: 10 },
      { id: 3, name: "放入说明书/保修卡", required: ["manual", "warranty_card"], timeout: 10 },
      { id: 4, name: "放入充电线与配件", required: ["cable", "sim_pin"], timeout: 10 },
      { id: 5, name: "合盖封装", required: ["closed_box"], timeout: 10 },
    ];

    const LABELS = {
      open_box: "开口盒",
      phone: "手机",
      manual: "说明书",
      warranty_card: "保修卡",
      cable: "充电线",
      sim_pin: "SIM针",
      closed_box: "闭合盒",
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
      result: "待开始",
      records: [],
      steps: STEPS.map((step, index) => ({
        ...step,
        status: index === 0 ? "Idle" : "Idle",
        note: "等待执行",
        duration: 0,
      })),
      detections: [],
      warning: "",
      lastFrame: performance.now(),
      fps: 0,
    };

    function elapsedSeconds() {
      if (!state.running) return 0;
      const now = state.paused ? state.pausedAt : performance.now();
      return Math.max(0, (now - state.startedAt - state.pauseTotal) / 1000);
    }

    function formatTime(seconds) {
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
      return mm + ":" + ss;
    }

    function setScenario(value) {
      state.scenario = value;
      modeText.textContent = value === "normal" ? "正常顺序" : value === "skipDocs" ? "漏放说明书" : "手机提前放入";
      reset();
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
      state.result = "检测中";
      state.records = [];
      state.warning = "";
      state.steps = STEPS.map((step, index) => ({
        ...step,
        status: index === 0 ? "Running" : "Idle",
        note: index === 0 ? "正在检测" : "等待执行",
        duration: 0,
      }));
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
      state.result = "待开始";
      state.records = [];
      state.warning = "";
      state.detections = [];
      state.steps = STEPS.map((step) => ({ ...step, status: "Idle", note: "等待执行", duration: 0 }));
      startBtn.textContent = "开始检测";
      pauseBtn.textContent = "暂停";
    }

    function completeCurrentStep(nowSeconds) {
      const step = state.steps[state.currentIndex];
      step.status = "Done";
      step.note = "已完成";
      step.duration = Math.max(0, nowSeconds - state.stepStartedAt);
      state.records.push({
        at: nowSeconds.toFixed(2),
        step: step.name,
        status: "Done",
        detections: state.detections.map((item) => ({
          className: item.className,
          confidence: Number(item.confidence.toFixed(2)),
        })),
      });
      state.currentIndex += 1;
      state.stableFrames = 0;
      state.stepStartedAt = nowSeconds;
      if (state.currentIndex >= state.steps.length) {
        state.result = "OK";
        state.running = false;
        return;
      }
      state.steps[state.currentIndex].status = "Running";
      state.steps[state.currentIndex].note = "正在检测";
    }

    function markNg(reason, nowSeconds) {
      const step = state.steps[state.currentIndex];
      if (step) {
        step.status = "NG";
        step.note = reason;
      }
      state.result = "NG";
      state.running = false;
      state.warning = reason;
      state.records.push({
        at: nowSeconds.toFixed(2),
        step: step ? step.name : "未知步骤",
        status: "NG",
        reason,
      });
    }

    function updateState(nowSeconds) {
      if (!state.running || state.paused) return;
      if (state.stepStartedAt === 0) {
        state.stepStartedAt = nowSeconds;
      }
      const current = state.steps[state.currentIndex];
      if (!current) return;

      const classSet = new Set(state.detections.map((item) => item.className));
      const lowConfidence = state.detections.some((item) => item.confidence < 0.72);
      const satisfied = current.required.every((className) => classSet.has(className));
      const hasHand = classSet.has("left_hand") || classSet.has("right_hand");

      if (state.scenario === "wrongOrder" && nowSeconds > 5 && nowSeconds < 9 && state.currentIndex === 0 && classSet.has("phone")) {
        markNg("顺序错误：手机在开口空盒确认前进入工位", nowSeconds);
        return;
      }

      if (lowConfidence) {
        state.warning = "存在低置信度目标，等待连续稳定帧";
      } else {
        state.warning = "";
      }

      if (satisfied && hasHand && !lowConfidence) {
        state.stableFrames += 1;
      } else if (satisfied && current.id === 1 && !lowConfidence) {
        state.stableFrames += 1;
      } else {
        state.stableFrames = Math.max(0, state.stableFrames - 1);
      }

      if (state.stableFrames >= 18) {
        completeCurrentStep(nowSeconds);
        return;
      }

      if (nowSeconds - state.stepStartedAt > current.timeout) {
        markNg("超时未完成：" + current.name, nowSeconds);
      }
    }

    function detection(className, x, y, w, h, confidence) {
      return { className, x, y, w, h, confidence };
    }

    function getDetections(t) {
      const list = [];
      const scenario = state.scenario;
      const jitter = Math.sin(t * 3) * 5;

      if (!state.running && state.result !== "OK" && state.result !== "NG") {
        return list;
      }

      if (scenario === "wrongOrder" && t > 4.5 && t < 8.5) {
        list.push(detection("phone", 470, 330, 260, 130, 0.94));
        list.push(detection("right_hand", 790 + jitter, 270, 150, 190, 0.91));
        return list;
      }

      if (t >= 1.5) {
        list.push(detection("open_box", 405, 250, 470, 285, 0.93));
      }
      if (t >= 6.5) {
        list.push(detection("phone", 485, 318, 290, 150, t < 7.5 ? 0.70 : 0.95));
      }
      if (t >= 12 && scenario !== "skipDocs") {
        list.push(detection("manual", 520, 335, 220, 118, 0.92));
        list.push(detection("warranty_card", 548, 370, 160, 72, 0.89));
      }
      if (t >= 20) {
        list.push(detection("cable", 515, 376, 210, 78, 0.91));
        list.push(detection("sim_pin", 715, 358, 48, 44, 0.86));
      }
      if (t >= 28) {
        const existing = list.filter((item) => !["open_box", "phone", "manual", "warranty_card", "cable", "sim_pin"].includes(item.className));
        existing.push(detection("closed_box", 430, 258, 430, 245, 0.95));
        list.splice(0, list.length, ...existing);
      }

      if (t > 2 && t < 38) {
        list.push(detection("left_hand", 300 + jitter, 350 + Math.sin(t) * 12, 150, 185, 0.94));
        list.push(detection("right_hand", 805 - jitter, 345 + Math.cos(t) * 10, 155, 190, 0.93));
      }
      return list;
    }

    function drawDesk() {
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
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.roundRect(1040, 255, 120, 220, 24);
      ctx.fill();
      ctx.fillStyle = "#05070c";
      ctx.beginPath();
      ctx.ellipse(72, 370, 44, 110, 0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(56, 213, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(150, 160, 900, 430);
      ctx.fillStyle = "rgba(56, 213, 255, 0.08)";
      ctx.fillRect(150, 160, 900, 430);
      ctx.fillStyle = "#7de7ff";
      ctx.font = "18px sans-serif";
      ctx.fillText("ROI 包装检测区域", 162, 186);
    }

    function drawObjects(t) {
      if (t >= 1.5 && t < 28) {
        ctx.fillStyle = "#0b1020";
        ctx.beginPath();
        ctx.roundRect(405, 250, 470, 285, 18);
        ctx.fill();
        ctx.fillStyle = "#1f2937";
        ctx.beginPath();
        ctx.roundRect(452, 297, 376, 190, 12);
        ctx.fill();
      }
      if (t >= 6.5 && t < 28) {
        ctx.fillStyle = "#101827";
        ctx.beginPath();
        ctx.roundRect(485, 318, 290, 150, 20);
        ctx.fill();
        ctx.fillStyle = "#223a55";
        ctx.beginPath();
        ctx.roundRect(506, 336, 248, 112, 12);
        ctx.fill();
        ctx.fillStyle = "#a6f3ff";
        ctx.font = "22px sans-serif";
        ctx.fillText("PHONE", 580, 398);
      }
      if (t >= 12 && t < 28 && state.scenario !== "skipDocs") {
        ctx.fillStyle = "#f4f7fa";
        ctx.fillRect(520, 335, 220, 118);
        ctx.fillStyle = "#64748b";
        ctx.font = "18px sans-serif";
        ctx.fillText("说明书", 590, 382);
        ctx.fillStyle = "#dbeafe";
        ctx.fillRect(548, 370, 160, 72);
        ctx.fillStyle = "#1e3a8a";
        ctx.fillText("保修卡", 598, 415);
      }
      if (t >= 20 && t < 28) {
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.arc(620, 405, 80, 0.3, 5.9);
        ctx.stroke();
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(715, 358, 48, 44);
      }
      if (t >= 28 || state.result === "OK") {
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(430, 258, 430, 245, 18);
        ctx.fill();
        ctx.fillStyle = "#27364e";
        ctx.fillRect(465, 300, 360, 150);
        ctx.fillStyle = "#b7e9ff";
        ctx.font = "28px sans-serif";
        ctx.fillText("已封装手机", 560, 383);
      }
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
      const cy = det.y + det.h * 0.22;
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
        const color = det.confidence < 0.72 ? "#f2c94c" : "#26d07c";
        if (isHand) {
          drawHand(det, color);
        }
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
      drawDesk();
      drawObjects(t);
      drawDetections(state.detections);
      if (state.warning || state.result === "NG") {
        ctx.fillStyle = "rgba(255, 92, 108, 0.88)";
        ctx.fillRect(150, 602, 900, 54);
        ctx.fillStyle = "#fff";
        ctx.font = "24px sans-serif";
        ctx.fillText(state.warning || "检测异常", 170, 638);
      }
    }

    function renderUI(t) {
      elapsedText.textContent = formatTime(t);
      resultText.textContent = state.result;
      resultChip.className = "chip " + (state.result === "OK" ? "ok" : state.result === "NG" ? "ng" : "");

      stepsTable.innerHTML = state.steps.map((step, index) => {
        const rowClass = step.status.toLowerCase();
        const pillClass = "status-pill " + rowClass;
        return "<tr class='" + rowClass + "'><td>" + step.id + "</td><td>" + step.name + "</td><td><span class='" + pillClass + "'>" + step.status + "</span></td><td>" + step.note + "</td></tr>";
      }).join("");

      stepsBar.innerHTML = state.steps.map((step) => {
        return "<div class='step-card " + step.status.toLowerCase() + "'><div class='name'>" + step.id + ". " + step.name + "</div><span class='status-pill " + step.status.toLowerCase() + "'>" + step.status + "</span></div>";
      }).join("");

      const current = state.steps[state.currentIndex] || state.steps[state.steps.length - 1];
      const classCounts = state.detections.reduce((acc, item) => {
        acc[item.className] = (acc[item.className] || 0) + 1;
        return acc;
      }, {});
      const validTargets = Object.keys(classCounts).map((key) => (LABELS[key] || key) + classCounts[key]).join("，") || "无";
      const doneCount = state.steps.filter((step) => step.status === "Done").length;
      const inferMs = Math.max(18, Math.round(34 + Math.sin(t * 2) * 8 + state.detections.length * 2));
      frameInfo.textContent = "FPS " + state.fps.toFixed(0) + " · 推理 " + inferMs + "ms";
      metricObjects.textContent = String(state.detections.length);
      metricStep.textContent = current ? String(current.id) : "-";
      metricDone.textContent = doneCount + "/" + state.steps.length;
      metricStable.textContent = String(state.stableFrames);

      logPanel.textContent = [
        "当前步骤：" + (current ? current.name : "全部完成"),
        "检测数量：" + state.detections.length,
        "检测耗时：" + inferMs + "ms",
        "有效目标：" + validTargets,
        "稳定帧数：" + state.stableFrames,
        "识别告警：" + (state.warning || "False"),
        "流程完成：" + (state.result === "OK" ? "True" : "False"),
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
        project: "手机检测与包装SOP",
        operator: "张三",
        scenario: state.scenario,
        result: state.result,
        durationSeconds: Number(elapsedSeconds().toFixed(2)),
        steps: state.steps.map((step) => ({
          id: step.id,
          name: step.name,
          status: step.status,
          note: step.note,
          duration: Number((step.duration || 0).toFixed(2)),
        })),
        events: state.records,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "phone-sop-detection-record.json";
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
