# 部署指南 · 今天吃什么

手机访问需要 **HTTPS**（浏览器定位要求）。推荐用 [Render](https://render.com) 免费部署，自动提供 `https://xxx.onrender.com` 链接。

## 一、推送代码到 GitHub

```bash
cd ~/Projects/jintian-chi-shenme

# 首次提交（如尚未提交）
git add .
git commit -m "准备云端部署"

# 在 GitHub 新建仓库 jintian-chi-shenme，然后：
git remote add origin https://github.com/你的用户名/jintian-chi-shenme.git
git push -u origin main
```

## 二、Render 部署（推荐）

1. 打开 [render.com](https://render.com) 注册 / 登录
2. **New +** → **Blueprint**，连接 GitHub 仓库
3. Render 会读取仓库里的 `render.yaml` 自动创建服务
4. 在部署页面填写环境变量（必填）：
   - `AMAP_KEY` — 高德 Web 服务 Key
   - `AI_API_KEY` — DeepSeek / OpenAI Key
5. 点击 **Deploy**，等待 3～5 分钟
6. 获得地址，例如：`https://jintian-chi-shenme.onrender.com`

### 手机访问

- 直接把 HTTPS 链接发到微信 / 浏览器打开
- 首次会请求定位权限，点允许即可
- 可「添加到主屏幕」当小程序用

> 免费版闲置 15 分钟后会休眠，首次打开需等约 30 秒唤醒。

## 三、环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `AMAP_KEY` | 是 | 高德 Web 服务 Key |
| `AI_API_KEY` | 是 | 大模型 API Key |
| `AI_BASE_URL` | 否 | 默认 `https://api.deepseek.com/v1` |
| `AI_MODEL` | 否 | 默认 `deepseek-chat` |
| `MOCK_MODE` | 否 | 生产环境保持 `false` |

## 四、本地验证生产模式

```bash
npm run build
NODE_ENV=production npm start
# 打开 http://localhost:3001
```

## 五、国内访问备选

若 Render 在国内较慢，可考虑：

- [Zeabur](https://zeabur.com) — 国内访问更友好，同样连接 GitHub 部署
- 腾讯云 / 阿里云轻量服务器 — 买一台 Node 服务器，执行 `npm run build && npm start`，用 Nginx 反代并配置 HTTPS

## 六、高德 Key 注意

部署后需在 [高德开放平台](https://lbs.amap.com/) 检查：

- Key 类型为 **Web 服务**
- 若设置了 IP 白名单，需加入 Render 出口 IP（或暂时取消白名单）
