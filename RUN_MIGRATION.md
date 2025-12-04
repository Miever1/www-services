# 数据库迁移指南 - 添加 images 列

## 方法 1: 使用 Docker Compose（推荐）

如果项目使用 Docker Compose，运行以下命令：

```bash
cd /Users/yunbai/Documents/GitHub/www-services
docker-compose up database-migrations
```

或者如果使用新版本的 Docker Compose：

```bash
cd /Users/yunbai/Documents/GitHub/www-services
docker compose up database-migrations
```

这会自动运行所有未执行的迁移文件，包括新添加的 `V4__task_images.sql`。

---

## 方法 2: 直接连接到数据库运行 SQL

### 选项 A: 连接到 Docker 容器中的数据库

1. 确保数据库容器正在运行：
```bash
docker ps | grep postgresql_database
```

2. 连接到数据库容器：
```bash
docker exec -it postgresql_database psql -U username -d database
```

3. 运行 SQL 命令：
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
```

4. 验证列是否已添加：
```sql
\d tasks
```

5. 退出：
```sql
\q
```

### 选项 B: 连接到远程数据库（Supabase）

如果使用的是 `DATABASE_URL` 中的 Supabase 数据库，可以使用 psql 客户端：

```bash
psql "postgresql://postgres.bjdhmwonadorlgpuldci:Shinkyukyaku!!1@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
```

然后运行：
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
```

### 选项 C: 使用数据库管理工具

如果你有数据库管理工具（如 pgAdmin、DBeaver、TablePlus 等），可以：

1. 连接到数据库
2. 打开 SQL 查询窗口
3. 运行以下 SQL：
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
```

---

## 方法 3: 使用 Node.js/Deno 脚本（临时方案）

如果以上方法都不行，可以创建一个简单的脚本：

创建一个文件 `add-images-column.js`：

```javascript
import postgres from "postgres";

const sql = postgres();

try {
  await sql`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
  `;
  console.log('✅ images 列已成功添加！');
} catch (error) {
  console.error('❌ 错误:', error);
} finally {
  await sql.end();
}
```

然后运行：
```bash
cd server
deno run --allow-net --allow-env add-images-column.js
```

---

## 验证迁移是否成功

运行以下 SQL 查询来验证：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'images';
```

如果查询返回结果，说明迁移成功！

---

## 注意事项

⚠️ **重要提示**：
- 如果数据库在生产环境，建议先备份
- `IF NOT EXISTS` 确保即使列已存在也不会报错，可以安全地多次运行
- 添加列后，现有任务的 `images` 字段将自动设置为空数组 `[]`

