# 部署环境图片显示问题修复指南

## 问题描述
本地环境图片上传和显示正常，但部署后：
1. **新上传的帖子失败** - 显示 "Failed to create task: Unknown error"
2. **图片不显示** - 所有新上传的帖子都显示占位符（相机图标）

## 根本原因
**请求体大小限制** - 部署环境的 Nginx 或反向代理限制了请求体大小。当上传包含多张 base64 图片的任务时，请求体可能超过限制，导致：
- 请求被拒绝（413 Payload Too Large）
- 请求体被截断，导致 JSON 解析失败
- 服务器返回 "Unknown error"

## 可能的原因

### 1. 响应大小限制
部署环境（Nginx/反向代理）可能限制了响应体大小。当任务列表包含大图片时，响应可能被截断。

**解决方案：**
- 检查 Nginx 配置：`client_max_body_size` 和 `proxy_read_timeout`
- 检查是否有响应大小限制：`proxy_buffer_size`, `proxy_buffers`

### 2. JSONB 解析问题
部署环境的 PostgreSQL 版本或配置可能导致 JSONB 字段解析不同。

**解决方案：**
- 确保部署环境的 PostgreSQL 版本与本地一致
- 检查 `task-service.js` 中的 JSONB 解析逻辑是否正确

### 3. 错误处理
添加了详细的日志记录，检查部署服务器日志：
```bash
pm2 logs www-backend
# 或
tail -f /path/to/logs
```

## 已实施的修复

1. **优化任务列表 API**
   - 只返回第一张图片，减少响应大小
   - 添加响应大小日志记录

2. **改进错误处理**
   - 添加 try-catch 错误捕获
   - 添加详细的日志记录

3. **JSONB 解析优化**
   - 在 `task-service.js` 中正确解析 JSONB 字段
   - 处理字符串和对象两种格式

## 部署环境检查清单

1. **检查 Nginx 配置**（必须！）
   
   找到 Nginx 配置文件（通常在 `/etc/nginx/sites-available/` 或 `/etc/nginx/nginx.conf`）：
   
   ```nginx
   # 在 http 或 server 块中添加：
   client_max_body_size 50M;      # ⚠️ 必须设置！允许大的请求体（包含 base64 图片）
   client_body_timeout 300s;       # 增加请求体超时
   proxy_read_timeout 300s;        # 增加读取超时
   proxy_connect_timeout 300s;     # 增加连接超时
   proxy_send_timeout 300s;        # 增加发送超时
   proxy_buffer_size 128k;         # 增加缓冲区大小
   proxy_buffers 4 256k;           # 增加缓冲区数量和大小
   proxy_busy_buffers_size 256k;   # 增加忙碌缓冲区大小
   
   # 如果使用反向代理，在 location /api 块中也要设置：
   location /api {
       proxy_pass http://localhost:8000;
       client_max_body_size 50M;   # ⚠️ 重要！
       proxy_read_timeout 300s;
       # ... 其他配置
   }
   ```
   
   **修改后重启 Nginx：**
   ```bash
   sudo nginx -t          # 测试配置
   sudo systemctl reload nginx  # 或 sudo service nginx reload
   ```

2. **检查 PM2 配置**
   ```json
   {
     "max_memory_restart": "1G",
     "node_args": "--max-old-space-size=1024"
   }
   ```

3. **检查数据库连接**
   - 确保 PostgreSQL 连接正常
   - 检查 JSONB 字段是否正确存储

4. **检查日志**
   - 查看服务器日志中的错误信息
   - 查找 "List tasks" 或 "Show task" 相关日志

## 下一步建议

1. **短期方案**：优化图片存储
   - 考虑将图片上传到云存储（AWS S3, Cloudinary 等）
   - 数据库中只存储图片 URL

2. **长期方案**：实现图片处理
   - 自动生成缩略图
   - 按需加载图片（懒加载）

## 调试命令

```bash
# 1. 检查部署环境响应
curl -v https://baicloud.miever.net/api/tasks | head -100

# 2. 检查特定任务
curl -v https://baicloud.miever.net/api/tasks/{task-id}

# 3. 查看服务器日志（最重要！）
pm2 logs www-backend --lines 100
# 或
tail -f /home/ubuntu/www-service/backend/logs/*.log

# 4. 测试上传任务（查看实际错误）
curl -X POST https://baicloud.miever.net/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"test","location":"test","price":10,"type":"need"}' \
  -v

# 5. 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 6. 检查 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log | grep -i "413\|400\|500"
```

## 快速修复步骤

1. **SSH 到部署服务器**
   ```bash
   ssh ubuntu@your-server-ip
   ```

2. **检查 Nginx 配置**
   ```bash
   sudo nano /etc/nginx/sites-available/default
   # 或
   sudo nano /etc/nginx/nginx.conf
   ```

3. **添加或修改以下配置**
   ```nginx
   client_max_body_size 50M;
   ```

4. **测试并重启 Nginx**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **检查后端日志**
   ```bash
   pm2 logs www-backend --lines 50
   ```

6. **重新测试上传**

