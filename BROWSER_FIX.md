# 浏览器连接问题修复指南

## 问题现象
浏览器无法连接到后端API (localhost:8000)，显示 "Failed to fetch" 错误。

## 解决方案

### 方案1: Chrome浏览器 - 禁用私有网络请求阻止

1. 在Chrome地址栏输入：
   ```
   chrome://flags/#block-insecure-private-network-requests
   ```

2. 找到 "Block insecure private network requests" 选项

3. 将其设置为 **Disabled**

4. 重启Chrome浏览器

### 方案2: 检查浏览器控制台

1. 按 F12 打开开发者工具
2. 查看 Console 标签中的错误信息
3. 查看 Network 标签：
   - 点击失败的请求 (红色)
   - 查看详细信息，特别是：
     - Status Code
     - CORS Headers
     - Error Message

### 方案3: 检查防火墙/代理设置

确保没有防火墙或代理阻止了 localhost:8000 的连接。

### 方案4: 尝试不同的浏览器

如果Chrome不行，试试：
- Safari
- Firefox
- Edge

## 临时解决方案

如果以上都不行，可以尝试：

1. 使用代理或修改hosts文件
2. 检查Docker网络配置
3. 检查端口是否被其他程序占用

