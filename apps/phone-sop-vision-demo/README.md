# AI 视觉 SOP 合规检测系统演示包

这是一个基于最新产品设计文档实现的本地可运行演示系统，用于展示“正面、反面、整体”三步检测 SOP 合规能力。

## 功能

- 单工位实时检测大屏
- 三步 SOP 检测流程：
  1. 正面
  2. 反面
  3. 整体
- 模拟 AI 视觉检测框、置信度、ROI 和手部关键点
- SOP 状态机：Idle / Running / Pass / Failed
- 正常检测、正面失败、反面失败、整体失败四种演示场景
- 正面/反面失败提示：`本次操作未按照SOP规范检测`
- 整体前置失败提示：`由于正面（反面）检测操作不符合SOP规范，请重新检测。`
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
