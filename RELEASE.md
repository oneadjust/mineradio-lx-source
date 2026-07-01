# Mineradio v1.2.0 发布说明

## 标题

```text
Mineradio v1.2.0 - LX URL 播放整合版
```

## 简介

这个版本保留 Mineradio 的界面、推荐、歌单和视觉体验，新增用户自导入 LX 自定义源的播放 URL 解析能力。

核心变化：网易云/QQ 继续负责推荐和歌单，播放时优先通过用户导入的 LX 源解析真实 URL。

## 更新亮点

- 新增 LX 自定义源导入弹窗，支持在线 JS 链接和本地文件。
- 新增统一播放解析入口，在线歌曲播放前优先尝试 LX URL。
- 网易云每日推荐、推荐歌曲、歌单和 QQ 搜索/歌单继续保留。
- 搜索页可展示 LX 结果，但只有用户导入自定义源后才启用。
- 播放信息区区分推荐来源和播放来源。
- LX 失败时回退原网易云/QQ 播放接口，并给出可读错误提示。
- 项目不内置、不分发任何默认 LX 源，用户脚本只保存到本机用户数据目录。

## 下载

请下载并运行：

```text
Mineradio-1.2.0-Setup.exe
```

不需要下载 `Source code`、`.blockmap` 或 `latest.yml`。

## 使用提示

首次使用 LX 播放前，需要在应用右上角点击 `LX源`：

1. 粘贴在线 LX 自定义源 JS 链接，或选择本地源文件。
2. 导入成功后再搜索或播放歌曲。
3. 如果没有导入源，LX 搜索和 LX 播放解析不会启用。

## 合规说明

Mineradio 不提供默认音源，不保证第三方源可用性，也不提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。请遵守对应平台协议和版权规则。

## 发布资产

- `dist/Mineradio-1.2.0-Setup.exe`
- `dist/Mineradio-1.2.0-Setup.exe.blockmap`
- `dist/latest.yml`
- `dist/Mineradio-1.2.0-SHA256SUMS.txt`

## SHA256

```text
9de0e2b69a1cc3a66efd15d9b99a1e8ef86c8b5022661880bf8d40cdb3f67c3c  Mineradio-1.2.0-Setup.exe
```
