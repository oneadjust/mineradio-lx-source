# Mineradio LX 音源整合复盘

本文记录 Mineradio 接入 LX 自定义源的改动思路、关键落点和下次官方更新后的补改步骤。目标是让后续合并官方版本时，可以快速恢复“Mineradio 界面 + 网易云/QQ 推荐 + 用户自导入 LX URL 播放”的能力。

## 核心思路

- Mineradio 继续负责桌面界面、首页推荐、歌单、队列、歌词、视觉系统和本地服务。
- 网易云/QQ 继续负责账号、推荐、歌单和搜索元数据。
- LX 自定义源只负责播放 URL 解析，不替代推荐算法。
- 项目不内置、不分发任何第三方 LX 源脚本或默认源地址。
- 用户导入的 LX 源保存到 Electron `userData`，不写入源码目录，不进入 Git。

一句话：推荐来源和播放来源解耦。

```text
网易云/QQ 推荐或歌单
        ↓
Mineradio 保留原始歌曲元数据
        ↓
resolvePlayableUrl(song)
        ↓
优先用 LX 自定义源解析 URL
        ↓
失败后回退 Mineradio 原网易云/QQ 播放接口
```

## 主要文件

- `server.js`
  - 初始化 `LxSourceManager`
  - 新增 `/api/lx/*` 和 `/api/play/resolve`
  - 在线歌曲播放统一进入解析入口
  - `/api/lx/search` 在未导入自定义源时返回空结果，避免误以为项目内置音源
- `lib/lx-source.js`
  - LX 自定义源运行时
  - 自定义源脚本加载、初始化、清除
  - `musicUrl` 调用封装
  - Kuwo 等跨源搜索匹配和封面字段归一
- `public/index.html`
  - 播放前调用 `/api/play/resolve`
  - 搜索结果支持 LX 标识，但仅在用户导入源后显示
  - 顶部和搜索区增加 LX 源导入入口
  - 增加真实导入弹窗，支持在线链接和本地文件
  - 播放信息区区分推荐来源与播放来源
- `desktop/main.js`
  - Electron `userData` 路径协作
  - 不从项目目录迁移默认源
- `.gitignore`
  - 忽略 `.lx-source.js`、Cookie、日志、构建产物和本地临时状态
- `package.json`
  - 打包时包含 `lib/**/*`

## 后端接口

### `GET /api/lx/sources`

返回 LX 搜索源和用户自定义源状态。关键字段：

- `hasCustomSource`
- `scriptPath`
- `sourceInfo`
- `error`

### `POST /api/lx/source/import`

导入本地 JS 脚本文本。

```json
{
  "script": "..."
}
```

### `POST /api/lx/source/import-url`

从用户提供的在线链接下载并导入源脚本。

```json
{
  "url": "https://example.com/source.js"
}
```

### `POST /api/lx/source/clear`

清除用户自定义源。

### `GET /api/lx/search`

用于 LX 搜索结果展示。未导入自定义源时必须返回空结果：

```json
{
  "source": "kw",
  "list": [],
  "total": 0,
  "disabled": true,
  "reason": "LX_CUSTOM_SOURCE_REQUIRED"
}
```

### `POST /api/play/resolve`

统一播放解析入口。前端播放在线歌曲时优先调用它。

```json
{
  "song": {},
  "quality": "lossless",
  "preferLx": true
}
```

返回示例：

```json
{
  "ok": true,
  "url": "https://...",
  "playSource": "lx",
  "matchedSource": "kw",
  "quality": "lossless"
}
```

## 播放解析策略

1. 从歌曲对象提取 `title / artists / album / duration / id / provider`。
2. 如果用户导入了 LX 自定义源，先用元数据跨源匹配。
3. 匹配优先级：
   - 歌名强匹配
   - 歌手相似
   - 专辑相似
   - 时长接近
4. 匹配成功后调用自定义源 `musicUrl`。
5. LX 返回真实 URL 时直接播放。
6. LX 未导入、未匹配、超时或未返回 URL 时，回退原平台接口。
7. 原平台也失败时返回结构化错误，前端给出可读提示。

## 合规边界

- 仓库不能包含默认 LX 源 URL。
- 仓库不能包含 `.lx-source.js`。
- README 和 Release 必须说明：用户需自行导入自定义源，项目不保证第三方源可用性。
- 不宣传绕过会员、破解版权或重新分发音乐内容。
- LX 只是用户自备脚本的本地运行兼容层。

## 官方更新后的补改步骤

1. 拉取官方新版代码，先保留官方 UI 和服务端结构。
2. 确认 `package.json` 的 `build.files` 仍包含 `lib/**/*`。
3. 复制或重新合并 `lib/lx-source.js`。
4. 在 `server.js` 恢复：
   - `LxSourceManager` 引入和初始化
   - `/api/lx/sources`
   - `/api/lx/source/import`
   - `/api/lx/source/import-url`
   - `/api/lx/source/clear`
   - `/api/lx/search`
   - `/api/play/resolve`
5. 在前端恢复：
   - `postJson`
   - `resolveOnlinePlaybackUrl`
   - `importLxSourceFile`
   - `openLxSourceModal`
   - `submitLxSourceUrl`
   - `importLxSourceLocalFile`
   - `clearLxSource`
   - `hasLxCustomSource`
6. 搜索结果恢复 LX gating：未导入自定义源时不展示 LX 搜索结果。
7. 播放入口统一改为 `/api/play/resolve`，不要散落调用 `/api/song/url` 或 `/api/qq/song/url`。
8. 恢复封面代理对 Kuwo/QQ 等图片域名的 referer 处理。
9. 检查 `.gitignore`，确保本地源和 Cookie 不进仓库。
10. 跑检查和构建。

## 回归检查清单

```powershell
git diff --check
node --check server.js
node --check lib\lx-source.js
node --check desktop\main.js
node -e "const fs=require('fs'),vm=require('vm');const s=fs.readFileSync('public/index.html','utf8');let i=0;for(const m of s.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){i++;new vm.Script(m[1],{filename:'public/index.html#script'+i})}console.log('inline scripts ok:',i)"
npm run build:win:dir
npm run build:win
```

功能验证：

- 未导入 LX 源时，搜索页不出现 LX 结果。
- 点击 LX 源按钮会出现导入弹窗。
- 在线链接和本地文件都能导入。
- 导入后播放网易云/QQ 推荐歌曲，优先显示 `播放: LX / ...`。
- LX 失败时能回退原平台或显示明确错误。
- 本地音乐、歌单、歌词、队列、窗口控制和视觉系统不回退。

## 发布前安全检查

- 搜索仓库，确认没有默认源地址：

```powershell
Select-String -Path public\index.html,server.js,lib\lx-source.js,desktop\main.js -Pattern 'raw.githubusercontent.com','DEFAULT_LX_SOURCE','huibq','pdone','flower/latest'
```

- 确认 Git 状态不包含：
  - `.cookie`
  - `.qq-cookie`
  - `.lx-source.js`
  - `dist/`
  - 用户数据目录

