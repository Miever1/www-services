# Nginx 配置修复指南 - HTTP 413 错误

## 🔴 问题确认
错误信息：**HTTP 413: Content Too Large**

这表示 Nginx 拒绝了请求，因为请求体（包含图片数据）超过了允许的最大大小。

## ✅ 解决方案

### 步骤 1: SSH 连接到服务器
```bash
ssh ubuntu@your-server-ip
```

### 步骤 2: 找到 Nginx 配置文件
```bash
# 查找配置文件
sudo ls -la /etc/nginx/sites-available/
sudo ls -la /etc/nginx/sites-enabled/

# 通常配置文件是：
# - /etc/nginx/sites-available/default
# - /etc/nginx/sites-available/baicloud.miever.net
# - /etc/nginx/nginx.conf
```

### 步骤 3: 编辑配置文件
```bash
# 使用你找到的配置文件名称
sudo nano /etc/nginx/sites-available/default
# 或
sudo nano /etc/nginx/sites-available/baicloud.miever.net
```

### 步骤 4: 添加/修改配置

找到 `server` 块，确保有以下配置：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name baicloud.miever.net;
    
    # ⚠️ 关键配置 1: 在 server 块顶部添加
    client_max_body_size 50M;        # 允许 50MB 的请求体
    client_body_timeout 300s;        # 请求体超时时间
    client_body_buffer_size 1M;      # 请求体缓冲区大小
    
    # 前端静态文件
    location / {
        root /home/ubuntu/www-service/frontend;
        try_files $uri $uri/ /index.html;
        
        # 可选：静态资源缓存
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # ⚠️ 关键配置 2: API 反向代理（必须存在！）
    location /api {
        proxy_pass http://localhost:8000;
        
        # ⚠️ 重要：这里也必须设置请求体大小限制
        client_max_body_size 50M;
        client_body_timeout 300s;
        
        # 代理超时设置（防止大请求超时）
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        
        # 代理头设置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 缓冲区设置（处理大响应）
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_temp_file_write_size 256k;
        
        # 禁用缓冲（可选，用于实时响应）
        # proxy_buffering off;
    }
}
```

### 步骤 5: 如果使用 HTTPS (SSL)
如果你使用 HTTPS，需要同时配置 443 端口：

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name baicloud.miever.net;
    
    # SSL 配置（如果有证书）
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 同样的配置...
    client_max_body_size 50M;
    
    location /api {
        proxy_pass http://localhost:8000;
        client_max_body_size 50M;
        # ... 其他配置同上
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name baicloud.miever.net;
    return 301 https://$server_name$request_uri;
}
```

### 步骤 6: 测试配置
```bash
# 测试 Nginx 配置语法
sudo nginx -t
```

如果看到 `syntax is ok` 和 `test is successful`，说明配置正确。

### 步骤 7: 重新加载 Nginx
```bash
# 重新加载配置（不会中断服务）
sudo systemctl reload nginx

# 或者重启（会短暂中断服务）
# sudo systemctl restart nginx
```

### 步骤 8: 验证修复
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志（实时监控）
sudo tail -f /var/log/nginx/error.log
```

### 步骤 9: 测试 API
在另一个终端窗口测试：
```bash
# 测试 API 是否可访问
curl -v https://baicloud.miever.net/api/tasks

# 测试大请求（模拟上传图片）
curl -X POST https://baicloud.miever.net/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"test"}' \
  -v
```

## 🔍 验证配置是否生效

运行以下命令检查当前配置：
```bash
# 查看当前 Nginx 配置
sudo nginx -T | grep -A 5 "client_max_body_size"
sudo nginx -T | grep -A 10 "location /api"
```

应该看到：
- `client_max_body_size 50M;` 在 server 块中
- `client_max_body_size 50M;` 在 `location /api` 块中

## 🐛 常见问题

### 问题 1: 修改后还是 413 错误
- 确保修改了**正确的**配置文件（可能是 sites-enabled 中的符号链接）
- 确保在 **server 块** 和 **location /api 块** 中都设置了 `client_max_body_size`
- 清除浏览器缓存并重试

### 问题 2: Nginx 配置测试失败
- 检查语法错误：`sudo nginx -t` 会显示具体错误
- 确保所有花括号都正确匹配
- 确保没有拼写错误

### 问题 3: 修改后 Nginx 无法启动
```bash
# 查看详细错误
sudo nginx -t -c /etc/nginx/nginx.conf

# 回滚配置
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo systemctl restart nginx
```

## 📝 完整的配置文件示例

如果配置文件为空或需要重建，这里是完整的示例：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name baicloud.miever.net;
    
    # 请求体大小限制（关键！）
    client_max_body_size 50M;
    client_body_timeout 300s;
    client_body_buffer_size 1M;
    
    # 日志
    access_log /var/log/nginx/baicloud_access.log;
    error_log /var/log/nginx/baicloud_error.log;
    
    # 前端
    location / {
        root /home/ubuntu/www-service/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API
    location /api {
        proxy_pass http://localhost:8000;
        
        # 请求体大小（关键！）
        client_max_body_size 50M;
        client_body_timeout 300s;
        
        # 超时
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        
        # 代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 缓冲区
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

## ✅ 修复后的验证

修复后，在浏览器中：
1. 打开 https://baicloud.miever.net/post
2. 尝试上传一个带图片的任务
3. 应该不再出现 413 错误
4. 如果还有问题，检查浏览器 Console 和 Network 标签页获取详细错误信息

