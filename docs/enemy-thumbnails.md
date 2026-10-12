# 敌人列表缩略图

`animepreview` 直接加载 `public/assets/enemies/thumbnails` 中的静态 WebP，不在客户端构建角色或生成缩略图。不同设备读取相同的服务端文件，首屏优先加载，其余图片按需加载。

- 每张 300×360 像素，WebP 质量 0.65，透明背景。
- 当前 34 个角色：原图风格约 0.725 MB，苍白风格约 0.712 MB；两套共约 1.437 MB。
- 完整部件贴图仍用于角色详情和游戏。列表页只下载缩略图。
- 文件名包含模型、相关贴图内容与渲染代码的版本摘要。修改某个角色时，只重生成受影响的图片，其他图片保留地址和浏览器缓存。

`npm run dev` 和 `npm run build` 会先检查、生成有变化的缩略图。在已经启动的开发服务器中修改姿态后，运行 `npm run enemies:thumbnails` 更新列表，生成的清单变化会触发页面热更新。

生成使用本机 Chrome、Edge 或 Chromium 的无界面 WebGL 渲染器。未改动的缩略图无需启动浏览器。找不到浏览器时，可设置 `ENEMY_THUMBNAIL_BROWSER` 指向可执行文件。

静态图片和 `src/render/enemy-thumbnails.generated.json` 都是项目文件，随服务端构建发布。Vite 开发与预览服务器为带摘要的缩略图设置一年缓存；其他部署服务器也可以为此目录设置 `Cache-Control: public, max-age=31536000, immutable`。
