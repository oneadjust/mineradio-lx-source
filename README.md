# Mineradio LX Source

这是一个基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) 的社区整合版，重点是保留 Mineradio 原有界面与推荐体验，并新增“用户自导入 LX 音源”的播放解析层。

项目名里的 `LX Source` 指的是兼容 LX 自定义源脚本的播放 URL 解析能力。它不是 Mineradio 官方版本，也不是 [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop) 官方客户端。

核心定位：网易云/QQ 负责推荐和歌单，用户自导入的 LX 自定义源负责播放 URL 解析。

## 上游与致谢

本项目是在两个优秀开源项目的基础上做的整合实验，respect 原作者：

- 界面与播放器基底：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)
- LX 自定义源生态与参考：[lyswhut/lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)

本仓库只维护整合改动和本地兼容层。原项目的设计、实现和生态贡献归各自作者所有。

## 项目优势

- 保留 Mineradio 的高级暗色界面、视觉控制台、桌面歌词和 3D 歌单体验。
- 首页推荐、每日推荐、用户歌单继续使用网易云/QQ 的成熟推荐体系。
- 播放时优先通过用户导入的 LX 自定义源解析 URL，原平台不可播时也会先尝试 LX。
- 不内置、不分发任何第三方音源脚本，用户源只保存到本机用户数据目录。
- 本地音乐、搜索、队列、歌词、封面、窗口控制和 GitHub 更新能力继续保留。

## 下载

请到 GitHub Releases 下载 Windows 安装包：

- 推荐文件：`Mineradio-1.2.0-Setup.exe`
- 不建议下载：`Source code`、`.blockmap`、`latest.yml`

如果浏览器或 Windows SmartScreen 提示风险，请确认文件来自本仓库 Release 后，再选择保留或仍要运行。未签名 Electron 小众软件偶尔会触发误报。

## 使用 LX 音源

1. 打开 Mineradio LX Source。
2. 点击右上角 `LX源`，或搜索区的 `导入LX源`。
3. 在弹窗里粘贴在线 JS 链接，或选择本地自定义源文件。
4. 导入成功后，播放网易云/QQ 推荐、歌单或搜索结果时，会优先尝试 LX URL。

说明：

- 项目不会自带默认 LX 源。
- 第三方源是否可用取决于用户自行导入的脚本。
- LX 失败时会回退 Mineradio 原网易云/QQ 播放接口。
- 请遵守对应平台协议、版权规则和会员权益规则。

## 功能概览

- 网易云音乐账号、每日推荐、歌单、搜索和播客。
- QQ 音乐搜索、登录态和歌单补充。
- LX 自定义源导入、清除、跨源匹配和 URL 解析。
- 本地音乐导入、封面上传裁剪、自定义歌词。
- 歌词舞台、粒子视觉、电影镜头、DIY 视觉控制台。
- 3D 歌单架和沉浸式 Home 页面。
- GitHub Release 更新检测。

## 开发运行

```bash
npm install
npm start
```

构建 Windows 安装包：

```bash
npm run build:win
```

仅构建解包目录用于本地验证：

```bash
npm run build:win:dir
```

## 关键文档

- [LX 音源整合复盘](./docs/LX_SOURCE_INTEGRATION.md)
- [隐私说明](./PRIVACY.md)
- [安全说明](./SECURITY.md)
- [更新日志](./CHANGELOG.md)

## 第三方平台说明

Mineradio LX Source 不是 Mineradio 官方版本，不是 LX Music 官方客户端，也不是网易云音乐、QQ 音乐或任何音乐平台的官方客户端。

项目中的第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。项目不提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。

## 许可

本项目基于 GPL-3.0 授权。详见 [LICENSE](./LICENSE)。
