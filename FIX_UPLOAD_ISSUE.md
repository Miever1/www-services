# 修复照片上传失败问题（HTTP 413）

## 🔍 问题诊断

你的后端确实是 **Deno**（使用 Hono 框架）。上传照片失败的原因是：

1. **Nginx 限制请求大小** - 默认只允许 1MB，照片通常更大
2. **Deno 服务器也可能有大小限制**

## 🎯 解决方案

需要在**服务器**上修改两个地方：

### 1. 修改 Nginx 配置（必须）

在服务器上运行以下命令来修复 Nginx：

```bash
# 备份原配置
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 编辑配置文件
sudo nano /etc/nginx/sites-available/default
```

在配置文件中找到 `server {` 块，添加：

```nginx
server {
    client_max_body_size 50M;  # 添加这一行
    
    # ... 其他配置 ...
    
    location /api {
        client_max_body_size 50M;  # 也添加这一行
        proxy_pass http://localhost:8000;  # 或你的 Deno 服务器地址
        # ... 其他配置 ...
    }
}
```

保存后测试并重载：

```bash
# 测试配置
sudo nginx -t

# 如果测试通过，重载 Nginx
sudo systemctl reload nginx
```

### 2. 检查 Deno 服务器配置

Deno 服务器本身通常没有大小限制，但需要确认服务器正在运行。

检查服务器状态：

```bash
# 查看 Docker 容器状态（如果使用 Docker）
docker ps

# 或者查看服务状态
systemctl status your-service-name
```

## 🚀 一键修复脚本

如果你可以 SSH 到服务器，运行这个脚本：

```bash
#!/bin/bash
# 备份配置
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 添加 client_max_body_size 到 server 块
sudo sed -i '/^[[:space:]]*server[[:space:]]*{/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default

# 添加 client_max_body_size 到 location /api 块
sudo sed -i '/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default

# 测试配置
if sudo nginx -t; then
    # 重载 Nginx
    sudo systemctl reload nginx
    echo "✅ Nginx 配置已更新并重载"
else
    echo "❌ Nginx 配置有错误，请检查"
    exit 1
fi
```

## 📋 如果你无法 SSH 到服务器

### 方法 1：联系部署人员

把以下信息发给帮你部署的人：

```
需要在服务器上修改 Nginx 配置：

1. 编辑 /etc/nginx/sites-available/default
2. 在 server { 块中添加：client_max_body_size 50M;
3. 在 location /api { 块中也添加：client_max_body_size 50M;
4. 运行：sudo nginx -t && sudo systemctl reload nginx
```

### 方法 2：通过 Docker Compose（如果使用）

如果部署使用 Docker Compose，可以添加 Nginx 配置：

创建 `nginx.conf`:

```nginx
server {
    listen 80;
    server_name baicloud.miever.net;
    
    client_max_body_size 50M;
    
    location /api {
        client_max_body_size 50M;
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location / {
        proxy_pass http://frontend:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方法 3：通过 GitHub Actions（如果使用 CI/CD）

如果部署使用 GitHub Actions，可以在部署脚本中添加：

```yaml
- name: Fix Nginx config
  run: |
    sudo sed -i '/^[[:space:]]*server[[:space:]]*{/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default
    sudo sed -i '/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default
    sudo nginx -t && sudo systemctl reload nginx
```

## ✅ 验证修复

修复后，测试上传：

1. 访问：https://baicloud.miever.net/post
2. 尝试上传一张照片
3. 检查浏览器控制台（F12），应该不再有 413 错误

## 🔍 其他可能的问题

如果修复后仍然失败，检查：

1. **Deno 服务器日志**：
   ```bash
   docker logs <container-name>
   # 或
   journalctl -u your-service-name -f
   ```

2. **Nginx 错误日志**：
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **确认 Deno 服务器地址**：
   - 检查 Nginx 配置中的 `proxy_pass` 地址
   - 确认 Deno 服务器正在运行在正确的端口

## 💡 需要帮助？

告诉我：
1. 你可以访问服务器吗？
2. 部署是通过什么方式？（Docker、直接部署、GitHub Actions 等）
3. 你有部署人员的联系方式吗？

我可以提供更具体的帮助！

