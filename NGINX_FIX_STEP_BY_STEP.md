# Nginx 配置修复 - 详细步骤指南

## 🔍 第一步：找到配置文件位置

### 方法 1：通过 SSH 连接并查找

1. **打开终端，SSH 连接到你的服务器**
   ```bash
   ssh ubuntu@your-server-ip
   # 替换 your-server-ip 为你的实际服务器 IP 地址
   ```

2. **查找 Nginx 配置文件**
   ```bash
   # 查看所有配置文件
   sudo ls -la /etc/nginx/sites-available/
   sudo ls -la /etc/nginx/sites-enabled/
   
   # 查找包含 baicloud 的配置
   sudo grep -r "baicloud" /etc/nginx/
   
   # 查看当前使用的配置
   sudo nginx -T | head -20
   ```

### 方法 2：运行查找脚本

我已经创建了一个查找脚本，你可以运行：

```bash
# 在服务器上运行
bash fix-nginx.sh
```

## 📝 第二步：编辑配置文件

根据第一步找到的配置文件，使用以下命令编辑：

```bash
# 通常配置文件在这里（选择一个）：
sudo nano /etc/nginx/sites-available/default
# 或
sudo nano /etc/nginx/sites-available/baicloud.miever.net
# 或
sudo nano /etc/nginx/nginx.conf
```

## ✏️ 第三步：修改配置内容

在打开的配置文件中，找到 `server` 块，看起来类似这样：

```nginx
server {
    listen 80;
    server_name baicloud.miever.net;
    
    location / {
        root /home/ubuntu/www-service/frontend;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        # ... 其他配置
    }
}
```

### 需要修改的地方：

1. **在 `server {` 之后立即添加**（或找到已有配置并修改）：
   ```nginx
   server {
       # ⚠️ 添加这行（如果没有的话）
       client_max_body_size 50M;
       
       listen 80;
       server_name baicloud.miever.net;
   ```

2. **在 `location /api {` 块内添加**：
   ```nginx
   location /api {
       proxy_pass http://localhost:8000;
       
       # ⚠️ 添加这行（如果没有的话）
       client_max_body_size 50M;
       
       # 其他配置...
   }
   ```

### 完整示例（如果你的配置文件很简单）

如果你的配置文件很简单，可以替换为：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name baicloud.miever.net;
    
    # ⚠️ 关键配置：允许大的请求体
    client_max_body_size 50M;
    client_body_timeout 300s;
    
    # 前端文件
    location / {
        root /home/ubuntu/www-service/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API
    location /api {
        proxy_pass http://localhost:8000;
        
        # ⚠️ 关键配置：允许大的请求体
        client_max_body_size 50M;
        client_body_timeout 300s;
        
        # 代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }
}
```

## 💾 第四步：保存文件

在 nano 编辑器中：
- 按 `Ctrl + O` 保存
- 按 `Enter` 确认文件名
- 按 `Ctrl + X` 退出

## ✅ 第五步：测试配置

```bash
# 测试配置文件语法是否正确
sudo nginx -t
```

**如果成功，你会看到：**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**如果有错误，会显示具体错误位置，修复后重新测试。**

## 🔄 第六步：应用配置

```bash
# 重新加载 Nginx（不会中断服务）
sudo systemctl reload nginx

# 或者重启（会短暂中断）
# sudo systemctl restart nginx
```

## 🔍 第七步：验证配置是否生效

```bash
# 检查配置是否生效
sudo nginx -T | grep "client_max_body_size"

# 应该看到类似这样的输出：
# client_max_body_size 50M;
# client_max_body_size 50M;
```

如果看到两个 `50M`，说明配置正确。

## 🧪 第八步：测试

1. 打开浏览器：https://baicloud.miever.net/post
2. 尝试上传一个带图片的任务
3. 不应该再出现 413 错误

## ❓ 常见问题

### Q: 找不到配置文件？
```bash
# 查看所有 Nginx 相关文件
sudo find /etc/nginx -type f -name "*.conf"

# 查看 Nginx 主配置文件（会显示所有包含的文件）
sudo nginx -T | grep -E "configuration file|included configuration"
```

### Q: 不知道哪个配置文件在生效？
```bash
# 查看当前使用的配置
sudo nginx -T

# 查看启用的站点
ls -la /etc/nginx/sites-enabled/
```

### Q: 修改后还是 413 错误？
```bash
# 确认配置已加载
sudo nginx -T | grep -A 2 "location /api"

# 重启 Nginx（如果 reload 不行）
sudo systemctl restart nginx

# 清除浏览器缓存并重试
```

## 📞 需要帮助？

如果遇到问题，请提供：
1. `sudo nginx -t` 的输出
2. `sudo nginx -T | grep -A 5 "location /api"` 的输出
3. 配置文件的具体内容（隐藏敏感信息后）

