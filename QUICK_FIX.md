# 🔧 快速修复指南

## 问题
浏览器无法连接到后端API (localhost:8000)，显示 "Failed to fetch" 错误。

## ⚡ 快速解决方案

### 方案1: Chrome浏览器设置（推荐）

1. **打开Chrome标志页**：
   - 在地址栏输入：`chrome://flags/#block-insecure-private-network-requests`
   - 或者：`chrome://flags/` 然后搜索 "Block insecure private network requests"

2. **禁用该选项**：
   - 找到 "Block insecure private network requests"
   - 设置为 **Disabled**

3. **重启Chrome浏览器**

4. **测试连接**：
   - 访问：http://localhost:5173
   - 尝试登录或查看网站功能

### 方案2: 使用Safari浏览器

Safari通常没有这个问题：
- 直接访问 http://localhost:5173
- 应该可以正常工作

### 方案3: 直接测试网站

不要用测试页面，直接访问主网站：
- http://localhost:5173
- 尝试登录功能
- 打开F12查看实际错误

## ✅ 验证修复

修复后，访问 http://localhost:5173 应该可以：
- 正常显示页面
- 可以登录
- 可以查看任务列表
- API请求成功（在F12 Network标签中查看）

## 📋 如果还是不行

请提供以下信息：
1. 使用的浏览器（Chrome/Safari/Firefox）
2. F12 Console中的完整错误信息
3. F12 Network标签中失败请求的详细信息

