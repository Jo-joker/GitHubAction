# 手机检测与包装 AI 视觉 SOP 合规检测系统演示包

这是一个基于产品设计文档实现的本地可运行演示系统，用于展示“手机检测和包装”的 AI 视觉 SOP 合规检测能力。

## 功能

- 单工位实时检测大屏
- 手机包装 SOP 五步流程：
  1. 开口空盒检测
  2. 放入手机并检测外观
  3. 放入说明书/保修卡
  4. 放入充电线与配件
  5. 合盖封装
- 模拟 AI 视觉检测框、置信度、ROI 和手部关键点
- SOP 状态机：Idle / Running / Done / NG
- 正常顺序、漏放说明书、手机提前放入三种演示场景
- 检测日志、指标面板和 JSON 检测记录导出

## 开发运行

```bash
npm install
npm run start:sop-demo
```

然后打开：

```text
http://127.0.0.1:4788
```

## 构建独立二进制包

```bash
npm install
npm run build:sop-demo
```

构建产物：

- `dist/phone-sop-vision-demo-linux-x64/sop-vision-demo`
- `dist/phone-sop-vision-demo-linux-x64.tar.gz`
- `dist/phone-sop-vision-demo-windows-x64/sop-vision-demo.exe`
- `dist/phone-sop-vision-demo-windows-x64.zip`

Linux 运行：

```bash
./dist/phone-sop-vision-demo-linux-x64/sop-vision-demo --no-open
```

Windows 运行：

```powershell
.\dist\phone-sop-vision-demo-windows-x64\sop-vision-demo.exe --no-open
```

> 注意：Linux 包中的 `sop-vision-demo` 是 ELF 可执行文件，不能在 Windows 中运行；Windows 需要使用 `phone-sop-vision-demo-windows-x64.zip` 内的 `sop-vision-demo.exe`。

## 说明

当前版本为可演示 MVP，内置模拟检测流来复刻产品能力。生产版本可将前端画面和状态机接入真实摄像头、目标检测模型和后端推理服务。
