# 部署环境图片显示问题修复指南

## 问题描述
本地环境图片上传和显示正常，但部署后看不到图片。

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

1. **检查 Nginx 配置**（如果使用）
   ```nginx
   client_max_body_size 50M;  # 允许大的请求体
   proxy_read_timeout 300s;    # 增加读取超时
   proxy_buffer_size 64k;      # 增加缓冲区大小
   proxy_buffers 4 64k;        # 增加缓冲区数量
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
# 检查部署环境响应
curl -v https://your-domain.com/api/tasks | head -100

# 检查特定任务
curl -v https://your-domain.com/api/tasks/{task-id}

# 查看服务器日志
pm2 logs www-backend --lines 100
```

