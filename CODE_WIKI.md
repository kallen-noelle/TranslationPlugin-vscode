# TranslationPlugin-VSCode Code Wiki

> 版本：`0.1.34` · Publisher：`kallen-noelle`  
> 基于 IntelliJ 平台同名插件（Yii.Guxing）移植的 VS Code 扩展，两者共享同一个生词本数据库。

---

## 目录

1. [项目概览](#1-项目概览)
2. [整体架构](#2-整体架构)
3. [目录结构](#3-目录结构)
4. [核心数据流](#4-核心数据流)
5. [模块职责与关键类/函数](#5-模块职责与关键类函数)
   - 5.1 [入口与生命周期](#51-入口与生命周期)
   - 5.2 [配置与状态存储](#52-配置与状态存储)
   - 5.3 [翻译引擎层](#53-翻译引擎层)
   - 5.4 [翻译服务与缓存编排](#54-翻译服务与缓存编排)
   - 5.5 [TTS 语音合成](#55-tts-语音合成)
   - 5.6 [音频播放](#56-音频播放)
   - 5.7 [编辑器交互层](#57-编辑器交互层)
   - 5.8 [Webview 面板层](#58-webview-面板层)
   - 5.9 [生词本](#59-生词本)
   - 5.10 [HTTP 与辅助工具](#510-http-与辅助工具)
6. [依赖关系图](#6-依赖关系图)
7. [运行与构建](#7-运行与构建)
8. [配置项一览](#8-配置项一览)
9. [命令一览](#9-命令一览)

---

## 1. 项目概览

这是一个功能完备的 VS Code 翻译扩展，核心能力包括：

| 能力 | 说明 |
|---|---|
| **多引擎翻译** | Microsoft Translator（免费，Bing 后端）、Google Translate（免费）、OpenAI（需 API Key） |
| **词典查询** | Microsoft/Google 原生词典端点，返回按词性分组的释义 |
| **悬停翻译** | 鼠标悬停单词即时翻译 + 文档注释翻译 |
| **翻译弹窗** | 独立 Webview 面板，支持手动输入、语言切换、历史记录 |
| **TTS 朗读** | Edge TTS（免费 WebSocket）、OpenAI TTS |
| **生词本** | 基于 SQLite，与 IntelliJ 插件共享，支持导入/导出 |
| **每日一词** | 内置编程词汇表，按日期循环展示 |
| **文档/注释翻译** | 整篇文档翻译、选区注释批量翻译 |
| **替换为译文** | 支持 camelCase / snake_case / PascalCase / kebab-case 格式 |
| **两级缓存** | 内存 LRU + 磁盘 JSON 文件 |

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │  commands.ts  │  │   hover.ts    │  │    wordBookView.ts    │ │
│  │  命令注册层   │  │  悬停Provider  │  │   侧边栏 Webview      │ │
│  └──────┬───────┘  └──────┬────────┘  └──────────┬──────────────┘ │
│         │                 │                       │               │
│         └─────────────────┼───────────────────────┘               │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    service.ts（翻译编排）                    │   │
│  │           cache: memory Map + disk JSON 文件                │   │
│  └────────────────────────┬───────────────────────────────────┘   │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │          translator/registry.ts（引擎注册中心）              │   │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐                │   │
│  │  │ microsoft│ │  google   │ │   openai     │                │   │
│  │  └──────────┘ └───────────┘ └──────────────┘                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                tts/index.ts（TTS 编排）                     │   │
│  │  ┌──────────────┐  ┌──────────────────┐                    │   │
│  │  │  tts/edge.ts │  │  tts/openai.ts   │                    │   │
│  │  └──────┬───────┘  └────────┬─────────┘                    │   │
│  └─────────┼───────────────────┼───────────────────────────────┘   │
│            ▼                   ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  audioPlayer.ts（音频播放）                  │   │
│  │   Windows: PowerShell + mciSendString (winmm.dll)          │   │
│   │   macOS: afplay                                             │   │
│  │   Linux: paplay / aplay                                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                      数据持久层                             │   │
│  │  wordbookDb.ts (SQLite) │ store.ts (globalState)            │   │
│  │  cacheService.ts (磁盘缓存) │ Config (workspace config)     │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Webview 面板架构：**

```
panel.ts (BasePanel 抽象基类)
    ├── translationDialog.ts   → translationDialog.html
    ├── wordOfDay.ts           → wordOfDay.html
    └── wordDetails.ts         → wordDetails.html

wordBookView.ts (WebviewViewProvider)
    └── wordBookWebview.html   (侧边栏固定面板)
```

所有 Webview 与扩展宿主之间使用 `postMessage` 通信，消息格式为 `{ type: string, ...payload }`。

---

## 3. 目录结构

```
src/
├── extension.ts              # 入口：activate / deactivate
├── config.ts                 # 配置封装（单例）
├── store.ts                  # 状态存储（globalState 封装 + 历史记录 + 生词本代理）
├── types.ts                  # 核心类型定义（Translator, Translation, DictItem, TranslationError）
├── commands.ts               # 所有 VS Code 命令的注册与实现
├── service.ts                # 翻译编排层（缓存 + 引擎调用 + 历史记录）
├── hover.ts                  # 悬停翻译 Provider（单词 + 文档注释）
├── http.ts                   # fetch 封装（get / postForm / postJson + HttpError）
├── feedback.ts               # 用户反馈（进度、错误对话框、OutputChannel 日志）
├── statusbar.ts              # 状态栏引擎指示器 + 引擎切换 QuickPick
├── audioPlayer.ts            # 跨平台 MP3 播放
├── cacheService.ts           # 磁盘缓存（JSON 文件，MAX 1024 条，5 天清理）
├── wordbookDb.ts             # SQLite 生词本数据库操作（与 IntelliJ 插件共享）
├── wordbookImportExport.ts   # 生词本 JSON / TXT / XML 导入导出
├── wordBookView.ts           # 侧边栏生词本 Webview + 设置面板
├── wordExtractor.ts          # 编辑器文本提取（选区 / 光标附近词 / camelCase 拆分）
├── comments.ts               # 多语言行注释检测
├── replace.ts                # 译文命名风格格式化（camelCase 等）
├── languages.ts              # 语言代码定义 + Microsoft 代码映射
├── camelCase.ts              # 纯 camelCase 拆分（无 VS Code 依赖，可独立测试）
├── words.ts                  # 每日一词内置词表
│
├── translator/
│   ├── registry.ts           # Translator 注册中心（引擎列表、当前引擎存取）
│   ├── microsoft.ts          # Microsoft/Bing 免费翻译引擎
│   ├── google.ts             # Google 免费翻译引擎
│   └── openai.ts             # OpenAI Chat Completions 翻译引擎
│
├── tts/
│   ├── index.ts              # TTS 编排（引擎选择 + 输出缓冲 + 播放）
│   ├── edge.ts               # Edge TTS WebSocket 协议实现
│   └── openai.ts             # OpenAI audio/speech API
│
└── webview/
    ├── panel.ts              # BasePanel 抽象基类（面板生命周期 + 消息桥）
    ├── translationDialog.ts  # 翻译弹窗面板
    ├── wordOfDay.ts          # 每日一词面板
    ├── wordDetails.ts        # 生词详情编辑面板
    └── media/
        ├── translationDialog.html
        ├── wordBookWebview.html
        ├── wordDetails.html
        └── wordOfDay.html
```

---

## 4. 核心数据流

### 4.1 翻译请求流程

```
用户操作（命令/悬停）
        │
        ▼
  commands.ts / hover.ts
        │  extractText() 提取文本
        ▼
  feedback.ts::translateWithFeedback()   ← 包装进度 + 错误 UI
        │
        ▼
  service.ts::translate(text, srcLang, tgtLang)
        │
        ├── 内存 Map 缓存 → 命中则返回
        ├── 磁盘 JSON 缓存 → 命中则写入内存并返回
        │
        ▼ 未命中
  registry.ts::getActiveEngine() → engine.translate()
        │
        ▼
  translator/microsoft.ts（以 MS 为例）
        │
        ├── fetchConfig()           ← 从 bing.com/translator 提取 IG/IID/token
        ├── callTranslate()         ← POST /ttranslatev3
        │   （若 srcLang=auto，从此处获取 detectedLang）
        └── callLookup()            ← POST /tlookupv3 获取词典
            （跳过 >80 字符 或 含空格的文本）
        │
        ▼
  service.ts → 写入内存/磁盘缓存 → 记录历史
        │
        ▼
  返回 Translation 对象
```

### 4.2 TTS 播放流程

```
speakText({ text, lang, engine? })
        │
        ▼
  tts/index.ts::speakText()
        │
        ├── edge:   edgeTtsToBuffer()
        │               ├── 按 200 字符切句
        │               ├── WebSocket 连 wss://speech.platform.bing.com/...edge/v1
        │               ├── 生成 DRM 令牌 (Sec-MS-GEC, 5分钟粒度)
        │               ├── 逐句发送 SSML
        │               └── 收集二进制 MP3 chunk → Uint8Array
        │
        ├── openai: openAiTtsToBuffer()
        │               └── POST /v1/audio/speech → MP3 bytes
        │
        ▼
  audioPlayer.ts::playAudio(buffer)
        │
        ├── Windows: PowerShell + mciSendString('open/play/close')
        ├── macOS:   afplay
        └── Linux:   paplay || aplay
```

---

## 5. 模块职责与关键类/函数

### 5.1 入口与生命周期

**文件：** [extension.ts](file:///d:/project/TranslationPlugin-vscode/src/extension.ts)

| 函数 | 说明 |
|---|---|
| `activate(context)` | 扩展激活入口。依次：初始化 Config/Store → 注册引擎 → 注册生词本视图 → 注册命令 + 悬停 → 调度每日一词自动弹出 / 自动翻译文档 / 上下文菜单键 |
| `scheduleWordOfDayAutoShow()` | 启动时根据配置延迟弹出 WordOfDay 面板（每天只弹一次） |
| `setupAutoTranslateDocument()` | 监听 `onDidOpenTextDocument`，符合条件时自动打开翻译弹窗 |
| `setupContextMenuKey()` | 设置 context key `translation.contextMenuRequiresSelection`，控制右键菜单可见性 |
| `deactivate()` | 空实现（subscriptions 由 VS Code 自动释放） |

激活时机：`onStartupFinished`（所有扩展加载完毕后再激活，避免阻塞启动）。

---

### 5.2 配置与状态存储

#### 5.2.1 Config

**文件：** [config.ts](file:///d:/project/TranslationPlugin-vscode/src/config.ts)

单例模式，封装 `vscode.workspace.getConfiguration('translation')`。

```typescript
class Config {
  static init(ctx: vscode.ExtensionContext): Config;
  static get(): Config;
  
  // 通用取值
  get<T>(key: string, defaultValue: T): T;
  
  // 快捷 getter
  readonly defaultEngine: string;       // 'microsoft'
  readonly sourceLanguage: string;      // 'auto'
  readonly targetLanguage: string;      // 'zh-CN'
  readonly ttsEngine: string;           // 'edge'
  readonly openAiBaseUrl: string;        // 去除尾部斜杠
  readonly edgeSpeedPercent: number;    // 解析 '25%' → 25
  // ... 等 20+ 个属性
  
  // API Key 存储（OS 密钥链）
  async getApiKey(engine: string): Promise<string | undefined>;
  async setApiKey(engine: string, apiKey: string): Promise<void>;
}
```

API Key 走 `ctx.secrets`（OS 安全存储），其他配置走 `workspace.configuration`。

#### 5.2.2 Store

**文件：** [store.ts](file:///d:/project/TranslationPlugin-vscode/src/store.ts)

单例，封装 `context.globalState`。生词本操作委托给 `wordbookDb.ts`。

| 方法 | 存储位置 | 说明 |
|---|---|---|
| `getHistory() / addHistory() / clearHistory()` | `globalState.history` | 翻译历史，按 `history.maxEntries` 截断 |
| `getWordBook() / addToWordBook() / removeFromWordBook() / clearWordBook()` | SQLite（委托 wordbookDb） | 生词本 CRUD |
| `getWordOfDayState() / setWordOfDayState()` | `globalState` | 每日一词当前索引 |
| `getWordOfDayAutoShownDate() / setWordOfDayAutoShownDate()` | `globalState` | 防止同一天重复弹出 |
| `getLastSourceLanguage() / setLastSourceLanguage()` | `globalState` | 记录用户上次选择的源/目标语言对 |

**辅助函数：**

| 函数 | 说明 |
|---|---|
| `saveTranslationToWordBook(t: Translation): Promise<boolean>` | 将 Translation 对象转为生词本格式：`phonetic` = 源音译，`explanation` = 译文 + 词性分组的词典释义 |

---

### 5.3 翻译引擎层

#### 5.3.1 Translator 接口

**文件：** [types.ts](file:///d:/project/TranslationPlugin-vscode/src/types.ts)

```typescript
interface Translator {
  readonly id: string;                          // 'microsoft' | 'google' | 'openai'
  readonly name: string;                        // 显示名
  readonly supportsAuto: boolean;                // 是否支持自动检测
  readonly supportedSourceLanguages: string[];
  readonly supportedTargetLanguages: string[];
  translate(text: string, srcLang: string, targetLang: string): Promise<Translation>;
}

interface Translation {
  original: string;
  translation: string | null;
  srcLang: string;            // 解析后的源语言（auto 时为检测值）
  targetLang: string;
  sourceLanguages: string[];  // 候选源语言列表
  srcTransliteration?: string | null;
  transliteration?: string | null;
  dict?: DictItem[];          // 词典（按词性分组）
}

interface DictItem {
  pos?: string;                                  // 词性标签，如 "名词"
  term?: string;
  entries?: { translation: string; backTranslations: string[] }[];
}

class TranslationError extends Error {
  readonly engineId?: string;
  readonly engineName?: string;
}
```

#### 5.3.2 Registry（引擎注册中心）

**文件：** [translator/registry.ts](file:///d:/project/TranslationPlugin-vscode/src/translator/registry.ts)

```typescript
const ENGINES: Translator[] = [GoogleTranslator, MicrosoftTranslator, OpenAiTranslator];

function initRegistry(ctx): void;
function getActiveEngine(): Translator;
function getActiveEngineId(): string;
function getEngine(id: string): Translator | undefined;
async function setActiveEngine(ctx, id: string): Promise<void>;  // 持久化到 globalState
```

`activeEngineId` 存于 `globalState.activeEngine`，未设置时回退到 `Config.defaultEngine`。

#### 5.3.3 MicrosoftTranslator

**文件：** [translator/microsoft.ts](file:///d:/project/TranslationPlugin-vscode/src/translator/microsoft.ts)

使用 Bing Translate 免费 Web 接口（无需 API Key）。

| 关键函数 | 说明 |
|---|---|
| `fetchConfig()` | 爬取 `https://www.bing.com/translator`，正则提取 `IG`、`IID`、`key`、`token` |
| `getConfig()` | Token 缓存 30 分钟，请求失败自动刷新，并发去重（configPromise） |
| `callTranslate(text, from, to, config)` | POST `/ttranslatev3`，返回译文 + 检测语言 + 音译 |
| `callLookup(text, from, to, config)` | POST `/tlookupv3`，按词性分组返回词典（>80字符或含空格跳过） |
| `posTagToLabel(posTag)` | Bing NOUN/VERB/ADJ → 中文"名词/动词/形容词" |
| `MicrosoftTranslator.translate()` | 自动模式下串行（先翻译获检测语言再查词典），手动模式下并行；空结果自动重试一次 |

**语言代码转换：** `toMicrosoftCode('auto') → 'auto-detect'`，`'zh-CN' → 'zh-Hans'` 等。

#### 5.3.4 GoogleTranslator

**文件：** [translator/google.ts](file:///d:/project/TranslationPlugin-vscode/src/translator/google.ts)

使用 `translate.google.com/translate_a/single` 免费接口，需计算 `tk` 令牌。

| 关键函数 | 说明 |
|---|---|
| `rl(a, b)` | Google 内部哈希算法的 JS 移植 |
| `computeTk(text, [h, i])` | 根据 tkk 值计算请求签名 |
| `fetchTkk()` | 从 `translate.google.com/translate_a/element.js` 提取 `tkk='xxx.xxx'`，缓存 1 小时 |
| `parseResponse(data, original, target)` | 解析 `sentences` / `src` / `dict` 为 Translation 对象 |

#### 5.3.5 OpenAiTranslator

**文件：** [translator/openai.ts](file:///d:/project/TranslationPlugin-vscode/src/translator/openai.ts)

基于 Chat Completions 接口，需 API Key。

| 关键函数 | 说明 |
|---|---|
| `buildTranslationMessages(text, srcLang, targetLang, isDocument)` | 构建 system + user 消息对；HTML 文档模式额外加 "不翻译 pre/code 标签" 指令 |
| `callChatCompletion(messages, config)` | POST `${baseUrl}/v1/chat/completions`；401 时明确报错 Key 无效 |
| `OpenAiTranslator.translate()` | 简单包装，无词典、音译返回 |
| `translateDocumentWithOpenAi(html, src, tgt)` | HTML 文档专用，自动去除 ```html 代码围栏 |

---

### 5.4 翻译服务与缓存编排

#### 5.4.1 service.ts

**文件：** [service.ts](file:///d:/project/TranslationPlugin-vscode/src/service.ts)

整个插件的翻译编排中枢。

| 函数 | 说明 |
|---|---|
| `translate(text, srcLang, targetLang, engineId?)` | **核心入口**：内存 Map → 磁盘 JSON → 引擎调用 → 写缓存 → 写历史 |
| `clearCache()` | 清空内存缓存 |
| `errorMessage(error)` | 简单错误转字符串（`feedback.describeError` 是增强版） |

**内存缓存淘汰策略：** 超 2000 条直接清空（简单粗暴，LRU 的轻量替代）。

#### 5.4.2 cacheService.ts

**文件：** [cacheService.ts](file:///d:/project/TranslationPlugin-vscode/src/cacheService.ts)

磁盘 JSON 缓存，路径：`%LOCALAPPDATA%\Yii.Guxing\TranslationPlugin\caches\{sha1}`（与 IntelliJ 插件一致）。

| 常量 | 值 | 说明 |
|---|---|---|
| `MAX_DISK_CACHE_SIZE` | 1024 | 最多缓存文件数 |
| `TRIM_INTERVAL_MS` | 5天 | 清理检查间隔 |

| 函数 | 说明 |
|---|---|
| `getDiskCache(text, src, tgt, engine)` | 读取并更新 atime |
| `putDiskCache(text, src, tgt, engine, translation)` | 写入 + 必要时清理 |
| `trimDiskCachesIfNeed()` | 按访问时间淘汰最旧的，保留 1024 个 |
| `getDiskCacheSize()` | 计算目录总字节数 |
| `evictAllDiskCaches()` | 清空整个缓存目录 |
| `formatByteSize(bytes)` | `1234 → "1.2KB"` |

---

### 5.5 TTS 语音合成

#### 5.5.1 tts/index.ts（编排层）

**文件：** [tts/index.ts](file:///d:/project/TranslationPlugin-vscode/src/tts/index.ts)

```typescript
async function speakText({ text, lang, engine?, voice? }): Promise<void>
```

流程：根据配置选引擎 → 引擎输出 `Uint8Array` MP3 → `playAudio()` 播放。

#### 5.5.2 tts/edge.ts（Edge TTS）

**文件：** [tts/edge.ts](file:///d:/project/TranslationPlugin-vscode/src/tts/edge.ts)

通过 WebSocket 连接 `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`。

| 关键项 | 说明 |
|---|---|
| `generateSecMsGecToken()` | SHA256 哈希时钟时间 + TrustedClientToken，5 分钟粒度 |
| `clockSkewSeconds` | 403 响应时从 Date 头校正时钟，自动重试一次 |
| `buildSsml(text, voice, rate)` | SSML 模板，支持 prosody rate (-50% ~ +100%) |
| `splitSentences(text, 200)` | 按句末标点切分，单段最长 200 字符 |
| `edgeTtsToBuffer(text, lang, voice?, rate?)` | 完整流程：选 voice → 切句 → WebSocket 交互 → 收集 MP3 chunk |
| `defaultVoiceForLang(lang)` | 硬编码 80+ 语言 → Edge voice 名称映射表 |

**WebSocket 消息格式：** 纯文本帧包含 `Path:` 头，二进制帧首 2 字节为 headerLength，之后是音频数据。遇到 `Path:turn.end` 进入下一句。

#### 5.5.3 tts/openai.ts

**文件：** [tts/openai.ts](file:///d:/project/TranslationPlugin-vscode/src/tts/openai.ts)

```typescript
async function openAiTtsToBuffer(text, voice?): Promise<Uint8Array>
// POST ${baseUrl}/v1/audio/speech
// body: { model: 'tts-1', input, voice, speed: 1, response_format: 'mp3' }
```

---

### 5.6 音频播放

**文件：** [audioPlayer.ts](file:///d:/project/TranslationPlugin-vscode/src/audioPlayer.ts)

跨平台方案：

| 平台 | 实现 |
|---|---|
| Windows | PowerShell + `[DllImport("winmm.dll")]` 调用 `mciSendString`，支持 MP3 |
| macOS | `afplay` 命令 |
| Linux | `paplay`（PulseAudio）→ 降级 `aplay`（ALSA） |

音频临时文件：`os.tmpdir()/translation-{hex}.mp3`，下次调用时自动删除上一个。

---

### 5.7 编辑器交互层

#### 5.7.1 commands.ts（命令注册）

**文件：** [commands.ts](file:///d:/project/TranslationPlugin-vscode/src/commands.ts)

所有命令的实现与注册。导出函数 `registerCommands(c: CommandContext): vscode.Disposable[]`。

| 命令 | 实现函数 | 说明 |
|---|---|---|
| `translation.showDialog` | `showDialog` | 打开翻译弹窗 |
| `translation.translate` | `translateSelection` | 翻译选区；单词走 hover 路线 |
| `translation.replaceWithTranslation` | `replaceWithTranslation` | 翻译并替换；可选格式选择 QuickPick |
| `translation.translateDocument` | `translateDocument` | 整篇翻译（OpenAI + HTML 特殊处理） |
| `translation.translateComments` | `translateComments` | 批量翻译选区/全文注释 |
| `translation.switchEngine` | `switchEngine` | QuickPick 切换引擎 |
| `translation.tts` | `tts` | 朗读选中文本（含简单语言检测） |
| `translation.saveWordBook` | `saveWordBook` | 选中文本 → 翻译 → 存生词本 |
| `translation.wordOfDay` | `wordOfDay` | 打开每日一词面板 |
| `translation.configure` | `configure` | 设置 OpenAI API Key 或打开设置 |
| `translation.showLog` | `showLogCommand` | 打开 OutputChannel |
| `translation.openSettings` | `openSettings` | 打开 `translation.*` 设置 |
| `translation.switchTtsEngine` | `switchTtsEngine` | QuickPick 切换 TTS 引擎 |
| `translation.hover.speak`（内部） | hover.ts 触发 | 朗读 |
| `translation.hover.copy`（内部） | hover.ts 触发 | 复制译文 |
| `translation.hover.save`（内部） | hover.ts 触发 | 收藏生词 |
| `translation.hover.openDialog`（内部） | hover.ts 触发 | 打开弹窗并预填 |

**特殊逻辑：** `translateSelection` 对纯单词（`/^[\p{L}\p{N}_]+$/u`）不走普通通知路径，而是将光标移到词首 + 执行 `editor.action.showHover` 触发 hover 样式弹窗。

#### 5.7.2 hover.ts（悬停翻译）

**文件：** [hover.ts](file:///d:/project/TranslationPlugin-vscode/src/hover.ts)

注册两个 HoverProvider：

| Provider | 说明 |
|---|---|
| `wordProvider` | 鼠标悬停单词 → 延迟 `hoverDelay` ms 后翻译 + 词典 + 操作链接 |
| `docProvider` | 调用 `vscode.executeHoverProvider` 获取语言服务的文档注释 → 估算英文占比 → 翻译 → 附加在悬停下方 |

**防递归机制：** `docProvider` 执行 `executeHoverProvider` 时设置 `inDocTranslateCall = true`，自身跳过。

**悬停操作链接：** 使用 `vscode.MarkdownString` 的 `command:translation.hover.speak?{args}` 语法，参数 URL-encoded。

#### 5.7.3 wordExtractor.ts（文本提取）

**文件：** [wordExtractor.ts](file:///d:/project/TranslationPlugin-vscode/src/wordExtractor.ts)

| 函数 | 说明 |
|---|---|
| `extractText(editor, mode: ExtractMode)` | 统一入口 |
| `extractWordRun(editor)` | 光标所在完整标识符，先 camelCase 拆词再拼接空格 |
| `extractNearestWord(editor)` | 光标附近的单个 sub-word |
| `splitWords(text)` | camelCase / snake_case 感知的分词算法（与 camelCase.ts 完全相同） |

`ExtractMode` 枚举：`Auto`（有选区用选区，否则 full run）/ `Inclusive`（忽略选区，full run）/ `Exclusive`（最近单词）。

#### 5.7.4 comments.ts（注释检测）

**文件：** [comments.ts](file:///d:/project/TranslationPlugin-vscode/src/comments.ts)

```typescript
function findCommentLines(doc, range): CommentLine[]
```

支持 30+ 语言的单行注释前缀映射（`//`、`#`、`--`、`;` 等）。自动跳过 shebang、pragma、region 等非注释行。

#### 5.7.5 replace.ts（格式化）

**文件：** [replace.ts](file:///d:/project/TranslationPlugin-vscode/src/replace.ts)

```typescript
function formatTranslation(translation: string, style: string): string
// style: camelCase | PascalCase | snake_case | kebab-case | original
```

核心步骤：`split(/[^\p{L}\p{N}]+/u)` 分词 → 按 style 重新拼接。

---

### 5.8 Webview 面板层

#### 5.8.1 panel.ts（BasePanel 基类）

**文件：** [webview/panel.ts](file:///d:/project/TranslationPlugin-vscode/src/webview/panel.ts)

抽象基类，封装：WebviewPanel 创建、消息桥接、生命周期、HTML 加载（`{{MEDIA}}` 占位符替换）。子类实现 `onMessage(msg)` 处理宿主←Webview 消息。

#### 5.8.2 translationDialog.ts

**文件：** [webview/translationDialog.ts](file:///d:/project/TranslationPlugin-vscode/src/webview/translationDialog.ts)

单例面板。支持：手动输入翻译、语言下拉切换、历史记录 Tabs、TTS 朗读、复制、收藏生词。

| 消息方向 | type | payload |
|---|---|---|
| Webview → Host | `translate` | `{ text, srcLang, targetLang }` |
| Webview → Host | `speak` | `{ text, lang }` |
| Webview → Host | `saveWord` | `{ original, translation, srcLang, targetLang }` |
| Webview → Host | `getHistory` / `clearHistory` | — |
| Host → Webview | `languages` | 全部语言列表 |
| Host → Webview | `init` | `{ srcLang, targetLang, activeEngine }` |
| Host → Webview | `result` / `error` | 翻译结果 |
| Host → Webview | `history` | `HistoryEntry[]` |

#### 5.8.3 wordOfDay.ts

**文件：** [webview/wordOfDay.ts](file:///d:/project/TranslationPlugin-vscode/src/webview/wordOfDay.ts)

单例面板。按 `dayOfYear(date) % WORD_LIST.length` 每日稳定选词，支持翻页、朗读、收藏。

#### 5.8.4 wordDetails.ts

**文件：** [webview/wordDetails.ts](file:///d:/project/TranslationPlugin-vscode/src/webview/wordDetails.ts)

每次打开即销毁上一个实例。支持编辑生词的音标、标签、释义。

---

### 5.9 生词本

#### 5.9.1 wordbookDb.ts

**文件：** [wordbookDb.ts](file:///d:/project/TranslationPlugin-vscode/src/wordbookDb.ts)

与 IntelliJ 插件完全兼容的 SQLite 存储。

**数据库路径解析优先级：**
1. `Config.wordbookPath`（自定义）
2. `%LOCALAPPDATA%\Yii.Guxing\TranslationPlugin\wordbook.sqlite`（Windows）
3. `$XDG_DATA_HOME/Yii.Guxing/TranslationPlugin/wordbook.sqlite`
4. `~/.TranslationPlugin/wordbook.sqlite`

**表结构：**

```sql
CREATE TABLE wordbook (
  "_id"           INTEGER PRIMARY KEY,
  word            TEXT     COLLATE NOCASE NOT NULL,
  source_language TEXT                   NOT NULL,
  target_language TEXT                   NOT NULL,
  phonetic        TEXT,
  explanation     TEXT,
  tags            TEXT,
  created_at      DATETIME               NOT NULL
);
CREATE UNIQUE INDEX wordbook_unique_index ON wordbook (word, source_language, target_language);
```

**CRUD 函数：**

| 函数 | 说明 |
|---|---|
| `getWordBook(customPath?)` | 全部条目按创建时间倒序 |
| `addWordToWordBook(input, customPath?)` | `INSERT OR IGNORE`，返回是否新增成功 |
| `removeWordFromWordBook(word, src, tgt, customPath?)` | 按唯一键删除 |
| `clearWordBook(customPath?)` | 清空 |
| `updateWordInWordBook(id, {phonetic?, explanation?, tags?})` | 更新可编辑字段 |

数据库连接是懒加载的，路径变化时自动重开（单例 `db` + `dbPath` 匹配机制）。开启 WAL 模式。

#### 5.9.2 wordBookView.ts（侧边栏）

**文件：** [wordBookView.ts](file:///d:/project/TranslationPlugin-vscode/src/wordBookView.ts)

实现 `WebviewViewProvider`，固定在侧边栏 Activity Bar。功能集：

- 生词列表表格（单词 | 释义）
- 右键：详情 / 复制 / 朗读 / 删除
- 工具栏：刷新 / 导入 / 导出
- **内嵌设置面板**：完整复刻 IntelliJ 版本的设置页（General → Font → Translation Popup → Text Selection → Translate and Replace → Daily Words → Wordbook → Cache and History → Others）
- 磁盘缓存清理 + 缓存大小显示
- 历史记录清理

#### 5.9.3 wordbookImportExport.ts

**文件：** [wordbookImportExport.ts](file:///d:/project/TranslationPlugin-vscode/src/wordbookImportExport.ts)

| 导出格式 | 函数 | 说明 |
|---|---|---|
| JSON | `exportWordBookJson()` | 完整字段 |
| TXT | `exportWordBookTxt()` | `word\texplanation`，每行一条 |
| XML | `exportWordBookXml()` | 结构化 XML |

**导入自动检测：** 先按内容（`{`/`[` → JSON，`<?xml`/`<wordbook` → XML），失败则按文件扩展名，最后 TXT。

---

### 5.10 HTTP 与辅助工具

#### 5.10.1 http.ts

**文件：** [http.ts](file:///d:/project/TranslationPlugin-vscode/src/http.ts)

基于 Node 18+ 全局 `fetch` 的轻量封装。

```typescript
class HttpError extends Error { readonly statusCode; readonly body; }

async function get(url, { timeout?, headers?, userAgent? }): Promise<string>;
async function postForm(url, params, options): Promise<string>;
async function postJson<T>(url, body, options): Promise<T>;
```

默认 15 秒超时，自动注入 `User-Agent`。

#### 5.10.2 feedback.ts

**文件：** [feedback.ts](file:///d:/project/TranslationPlugin-vscode/src/feedback.ts)

| 函数 | 说明 |
|---|---|
| `log(...args)` / `logError(error)` | 写入 OutputChannel "Translation" |
| `showLog()` | 打开 OutputChannel |
| `describeError(error)` | **错误转中文**：`TranslationError` 直接取 message；fetch/timeout 类错误统一翻译为中文提示 |
| `flashStatus(msg, timeout)` | 状态栏临时消息（默认 2.5s） |
| `truncate(text, max)` | 截断 + 省略号 |
| `showTranslationError(error, { retry? })` | 富错误对话框：按钮 "重试 / 切换引擎 / 检查配置" |
| `translateWithFeedback(text, src, tgt, { retry?, silentError? })` | `withProgress` 包装的翻译（进度 + 错误 UI + 日志） |
| `runWithProgress(title, action)` | 通用进度包装 |

#### 5.10.3 languages.ts

**文件：** [languages.ts](file:///d:/project/TranslationPlugin-vscode/src/languages.ts)

| 函数/常量 | 说明 |
|---|---|
| `LANGUAGES: Language[]` | 70+ 种语言，含 `code` / `name` / `nameZh` |
| `getLanguage(code)` | 按 code 查询 |
| `languageName(code)` / `languageNameZh(code)` | 语言名 |
| `toMicrosoftCode(code)` / `fromMicrosoftCode(code)` | Microsoft 特有映射（auto↔auto-detect, zh-CN↔zh-Hans） |

#### 5.10.4 camelCase.ts

**文件：** [camelCase.ts](file:///d:/project/TranslationPlugin-vscode/src/camelCase.ts)

纯工具模块，与 `wordExtractor.ts` 的 `splitWords` 实现完全相同。独立出来方便在 Node 环境中做单元测试。

#### 5.10.5 words.ts

**文件：** [words.ts](file:///d:/project/TranslationPlugin-vscode/src/words.ts)

30 个内置编程英语词汇，每个包含 `word / phonetic / translation / example / exampleTranslation`。用于每日一词功能。

---

## 6. 依赖关系图

### 6.1 外部依赖

```
better-sqlite3  ^13.0.3   ← wordbookDb.ts（运行时必须打包进 VSIX）
ws              ^8.18.0   ← tts/edge.ts（运行时必须打包进 VSIX）
```

> **注意** 根据项目历史：使用 `vsce package --no-dependencies` 会导致扩展静默激活失败（better-sqlite3 和 ws 缺失），必须用默认的 `vsce package`。

### 6.2 内部依赖（主要路径）

```
extension.ts
├── Config → workspace.getConfiguration + ctx.secrets
├── Store → ctx.globalState + wordbookDb
├── registry → google + microsoft + openai
├── commands → service, hover, webview/*, tts, wordbookDb, replace, comments, statusbar, feedback, wordExtractor
├── hover → service, feedback
└── wordBookView → Store, feedback, webview/*, wordbookImportExport, cacheService, statusbar

service.ts
├── registry → 取当前引擎
├── feedback → 日志
├── cacheService → 磁盘缓存读写
└── Store → 历史记录追加

translator/*
├── microsoft → languages（代码转换）, feedback（日志）
├── google → http（get, postForm）
└── openai → config（API Key）, http（postJson）, languages

tts/index.ts → edge + openai → audioPlayer
tts/edge.ts → ws（WebSocket）, crypto

audioPlayer.ts → child_process, fs, os, path, crypto

wordbookDb.ts → better-sqlite3, fs, path, os

cacheService.ts → fs, path, os, crypto

feedback.ts → service, registry（取引擎名）

statusbar.ts → registry
```

---

## 7. 运行与构建

### 7.1 环境要求

- Node.js ≥ 18（使用 `nodenext` 模块解析，需原生支持 fetch）
- VS Code ≥ 1.90.0
- pnpm（项目声明了 `packageManager: pnpm@11.22.0`）

### 7.2 开发流程

```bash
# 安装依赖
pnpm install

# 编译（TypeScript → out/）
pnpm run compile

# 监听编译（开发时推荐）
pnpm run watch

# 打包 VSIX（发布前）
pnpm run package   # = compile && vsce package
```

### 7.3 开发调试

VS Code 扩展开发：

1. `pnpm run watch` 持续编译
2. 按 F5 启动 Extension Development Host
3. 或在 VS Code 中打开命令面板 `Developer: Show Logs...` 选择 "Translation" OutputChannel 查看日志

`.vscode/launch.json` 和 `.vscode/tasks.json` 已配置好。

### 7.4 发布

```bash
# 手动发布（需要 Granular Access Token，带 Bypass 2FA）
vsce publish
```

---

## 8. 配置项一览

所有配置的前缀为 `translation.`：

| 配置键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `defaultEngine` | enum | `microsoft` | 翻译引擎 |
| `sourceLanguage` | string | `auto` | 源语言 |
| `targetLanguage` | string | `zh-CN` | 目标语言 |
| `ttsEngine` | enum | `edge` | TTS 引擎 |
| `tts.edge.voice` | string | `""` | Edge TTS voice 名 |
| `tts.edge.speed` | enum | `0%` | Edge TTS 语速 |
| `tts.openai.voice` | enum | `alloy` | OpenAI TTS voice |
| `openai.baseUrl` | string | `https://api.openai.com` | OpenAI 接口基址 |
| `openai.model` | string | `gpt-4o-mini` | OpenAI 翻译模型 |
| `hover.enabled` | boolean | `true` | 悬停翻译开关 |
| `hover.delay` | number | `300` | 悬停延迟(ms) |
| `hover.docTranslation` | boolean | `true` | 文档注释翻译 |
| `notification.showResult` | boolean | `true` | 通知中显示译文 |
| `replaceSeparator` | enum | `original` | 替换译文的命名风格 |
| `history.maxEntries` | number | `100` | 历史记录上限 |
| `wordbook.path` | string | `""` | 生词本自定义路径 |
| `wordOfDay.autoShow` | boolean | `true` | 启动自动弹出每日一词 |
| `wordOfDay.autoShowDelay` | number | `5` | 延迟秒数 |
| `wordOfDay.showDefinition` | boolean | `true` | 显示释义 |
| `mainLanguage` | string | `zh-CN` | 用户主语言 |
| `font.family` | string | `""` | 翻译显示字体 |
| `font.phonetic` | string | `""` | 音标字体 |
| `textSelection.stripPunctuation` | boolean | `false` | 去除标点 |
| `textSelection.preserveFormat` | boolean | `false` | 保留格式 |
| `textSelection.autoCapture` | boolean | `false` | 弹窗自动捕获选区 |
| `textSelection.regexFilter` | string | `""` | 正则过滤 |
| `popup.autoRead` | enum | `none` | 翻译后自动朗读 |
| `popup.position` | enum | `cursor` | 弹窗位置 |
| `popup.autoCopy` | boolean | `false` | 自动复制译文 |
| `replace.contextMenu` | boolean | `true` | 右键菜单项 |
| `replace.selectLanguageFirst` | boolean | `false` | 每次翻译先选语言 |
| `replace.useLastLanguage` | boolean | `false` | 记住上次语言对 |
| `replace.autoReplace` | boolean | `false` | 单结果时自动替换 |
| `autoTranslateDocument` | boolean | `true` | 打开文档自动翻译 |
| `contextMenuOnlyWithSelection` | boolean | `true` | 仅选中时显示右键菜单 |

API Key 不走配置项，通过 `translation.configure` 命令或侧边栏设置面板 → secrets 存储。

---

## 9. 命令一览

| Command ID | 标题 | 快捷键 |
|---|---|---|
| `translation.showDialog` | Translation: Show Translation Dialog... | `Ctrl+Shift+O` |
| `translation.translate` | Translation: Translate | `Ctrl+Shift+Y` |
| `translation.replaceWithTranslation` | Translation: Replace with Translation | `Ctrl+Shift+X` |
| `translation.switchEngine` | Translation: Switch Engine | `Ctrl+Shift+S` |
| `translation.translateDocument` | Translation: Translate Document | — |
| `translation.translateComments` | Translation: Translate Comments in Selection | — |
| `translation.tts` | Translation: Text to Speech | — |
| `translation.wordbook` | Translation: Word Book | — |
| `translation.wordbook.refresh` | 刷新（侧边栏工具栏） | — |
| `translation.wordbook.detail` | 详情（行内） | — |
| `translation.wordbook.export` | 导出（侧边栏工具栏） | — |
| `translation.wordbook.import` | 导入（侧边栏工具栏） | — |
| `translation.openSettings` | Translation: Open Settings | — |
| `translation.switchTtsEngine` | Translation: Switch TTS Engine | — |
| `translation.wordOfDay` | Translation: Word of the Day | — |
| `translation.saveWordBook` | Translation: Save to Word Book | — |
| `translation.configure` | Translation: Configure | — |
| `translation.showLog` | Translation: Show Log | — |

---

*文档由代码静态分析自动生成，基于 `package.json` 与全部 `src/*.ts` 源文件。*
