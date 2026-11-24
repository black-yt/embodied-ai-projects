# 具身智能项目展示

当前项目是[双臂精细操作](docs/projects/project-01/README.md)。[打开网站首页](docs/index.html)。

```text
docs/
├── index.html              # 项目列表
├── assets/                 # 全站样式与语言切换
└── projects/
    └── project-01/
        ├── index.html      # 展示页
        ├── README.md       # 项目概览
        └── assets/         # 项目交互和分视角录像
```

新增项目时，在 `docs/projects/` 下使用小写英文和连字符命名，放入项目页面和独立素材，再添加首页入口。页面默认英文，导航栏可切换中文。

GitHub Pages 发布源使用 `main` 分支的 `/docs` 目录。参见 [GitHub Pages 官方配置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
