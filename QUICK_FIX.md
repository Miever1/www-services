# 🚀 快速修复指南 - 3 步解决 HTTP 413 错误

## 方法 1：使用自动修复脚本（推荐）

### 步骤 1：SSH 连接到服务器
```bash
ssh ubuntu@your-server-ip
```

### 步骤 2：下载并运行自动修复脚本
```bash
# 下载脚本（从 GitHub 仓库）
cd /tmp
wget https://raw.githubusercontent.com/Miever1/www-services/feature/test/auto-fix-nginx.sh
# 或者直接创建文件并复制内容

# 运行脚本
sudo bash auto-fix-nginx.sh
```

脚本会自动：
- ✅ 备份配置文件
- ✅ 找到正确的配置文件
- ✅ 添加 `client_max_body_size 50M;`
- ✅ 测试配置
- ✅ 重新加载 Nginx

### 步骤 3：测试
打开 https://baicloud.miever.net/post 并尝试上传任务

---

## 方法 2：手动修复（如果脚本不工作）

### 步骤 1：SSH 连接到服务器
```bash
ssh ubuntu@your-server-ip
```

### 步骤 2：找到配置文件
```bash
# 查找配置文件
sudo ls -la /etc/nginx/sites-available/
sudo ls -la /etc/nginx/sites-enabled/

# 通常文件名是：default 或 baicloud.miever.net
```

### 步骤 3：编辑配置文件
```bash
sudo nano /etc/nginx/sites-available/default
```

### 步骤 4：添加配置

找到这行：
```nginx
server {
    listen 80;
```

在它下面添加：
```nginx
server {
    client_max_body_size 50M;    # ← 添加这行
    listen 80;
```

然后找到：
```nginx
location /api {
    proxy_pass http://localhost:8000;
```

在它下面添加：
```nginx
location /api {
    client_max_body_size 50M;    # ← 添加这行
    proxy_pass http://localhost:8000;
```

### 步骤 5：保存并应用
```bash
# 保存文件（在 nano 中：Ctrl+O, Enter, Ctrl+X）

# 测试配置
sudo nginx -t

# 如果测试通过，重新加载
sudo systemctl reload nginx
```

---

## 方法 3：一行命令修复（最简单）

如果你知道配置文件位置，可以直接运行：

```bash
# 备份
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 添加配置（如果不存在）
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default
sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default

# 测试并重新加载
sudo nginx -t && sudo systemctl reload nginx
```

---

## ✅ 验证修复

运行以下命令确认配置已生效：
```bash
sudo nginx -T | grep "client_max_body_size"
```

应该看到两行 `client_max_body_size 50M;`

---

## ❓ 如果还有问题

1. **检查 Nginx 错误日志**：
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **检查后端服务**：
   ```bash
   pm2 list
   pm2 logs www-backend
   ```

3. **测试 API 直接访问**：
   ```bash
   curl -v http://localhost:8000/tasks
   ```
