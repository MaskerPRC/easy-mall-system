# 域名邮件服务器远程调试指南

## 🎯 概述

本文档详细介绍了如何对部署在远程服务器上的域名邮件服务器进行调试。由于邮件服务器通常部署在具有公网IP的云服务器上，开发者需要掌握多种远程调试技术来有效地排查问题和优化性能。

## 🔧 调试方案概览

| 调试方案 | 适用场景 | 复杂度 | 实时性 |
|---------|---------|-------|-------|
| [SSH隧道 + Chrome DevTools](#ssh隧道--chrome-devtools) | 开发调试 | ⭐⭐ | 🔴 高 |
| [VS Code Remote调试](#vs-code-remote调试) | 开发调试 | ⭐⭐⭐ | 🔴 高 |
| [日志调试](#日志调试) | 生产环境 | ⭐ | 🟡 中 |
| [Docker远程调试](#docker远程调试) | 容器化部署 | ⭐⭐⭐ | 🔴 高 |
| [监控调试](#监控调试) | 性能优化 | ⭐⭐ | 🟢 低 |

## 🚀 准备工作

### 服务器环境要求

```bash
# 确保Node.js版本支持调试
node --version  # >= 16.0.0

# 确保有足够的内存和CPU
free -h
top
```

### 网络配置

```bash
# 检查防火墙设置
sudo ufw status

# 开放调试端口（谨慎使用，仅开发环境）
sudo ufw allow 9229/tcp  # Node.js调试端口
sudo ufw allow 9222/tcp  # Chrome DevTools端口
```

### 安全注意事项

⚠️ **重要安全提醒**：
- 调试端口不应在生产环境暴露给公网
- 使用SSH隧道或VPN进行安全连接
- 调试完成后立即关闭调试端口
- 生产环境建议使用日志调试而非实时调试

## 🔗 SSH隧道 + Chrome DevTools

### 方案概述

通过SSH隧道将远程Node.js调试端口转发到本地，然后使用Chrome DevTools进行调试。

### 步骤详解

#### 1. 修改启动脚本启用调试

在服务器上修改 `package.json`：

```json
{
  "scripts": {
    "debug": "node --inspect=0.0.0.0:9229 server.js",
    "debug-brk": "node --inspect-brk=0.0.0.0:9229 server.js"
  }
}
```

或者直接启动：

```bash
# 在服务器上启动调试模式
node --inspect=0.0.0.0:9229 server.js
```

#### 2. 建立SSH隧道

在**本地机器**上执行：

```bash
# 基本SSH隧道
ssh -L 9229:localhost:9229 username@your-server-ip

# 保持连接的SSH隧道
ssh -L 9229:localhost:9229 -N username@your-server-ip

# 后台运行SSH隧道
ssh -L 9229:localhost:9229 -N -f username@your-server-ip
```

#### 3. 使用Chrome DevTools

1. 打开Chrome浏览器
2. 访问 `chrome://inspect`
3. 点击 "Configure" 添加 `localhost:9229`
4. 在 "Remote Target" 中点击 "inspect"

#### 4. 调试技巧

```javascript
// 在代码中添加断点
debugger;

// 条件断点示例
if (process.env.NODE_ENV === 'development') {
  debugger;
}

// 邮件处理调试
async function handleEmail(emailData) {
  console.log('Processing email:', emailData.subject);
  debugger; // 在这里暂停
  
  // 邮件处理逻辑
  const result = await processEmailData(emailData);
  
  console.log('Email processed:', result);
  return result;
}
```

#### 5. 完整示例脚本

创建 `debug-setup.sh`：

```bash
#!/bin/bash

echo "=== 远程调试设置脚本 ==="

# 检查参数
if [ $# -eq 0 ]; then
    echo "使用方法: $0 <server-ip> [username]"
    echo "示例: $0 192.168.1.100 root"
    exit 1
fi

SERVER_IP=$1
USERNAME=${2:-root}
DEBUG_PORT=9229

echo "服务器: $USERNAME@$SERVER_IP"
echo "调试端口: $DEBUG_PORT"

# 建立SSH隧道
echo "建立SSH隧道..."
ssh -L $DEBUG_PORT:localhost:$DEBUG_PORT -N $USERNAME@$SERVER_IP &
SSH_PID=$!

echo "SSH隧道已建立 (PID: $SSH_PID)"
echo "请在另一个终端启动远程服务器的调试模式："
echo "  ssh $USERNAME@$SERVER_IP"
echo "  cd /path/to/mail-server"
echo "  npm run debug"
echo ""
echo "然后在Chrome中打开: chrome://inspect"
echo "配置目标: localhost:$DEBUG_PORT"
echo ""
echo "按Ctrl+C停止隧道"

# 等待用户中断
trap "kill $SSH_PID; echo '隧道已关闭'" EXIT
wait $SSH_PID
```

使用方法：

```bash
chmod +x debug-setup.sh
./debug-setup.sh your-server-ip username
```

## 💻 VS Code Remote调试

### 方案概述

使用VS Code的Remote开发扩展直接连接到远程服务器进行调试。

### 安装扩展

```bash
# VS Code扩展
Remote - SSH
Remote - Containers (如果使用Docker)
```

### 配置步骤

#### 1. 配置SSH连接

在VS Code中：
1. 按 `Ctrl+Shift+P`
2. 选择 "Remote-SSH: Connect to Host"
3. 添加新的SSH连接

或者编辑 `~/.ssh/config`：

```
Host mail-server
    HostName your-server-ip
    User username
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

#### 2. 创建调试配置

在远程服务器上创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "邮件服务器调试",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "name": "SMTP服务器调试",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/mail-server/smtp-server.js",
      "env": {
        "NODE_ENV": "development",
        "SMTP_PORT": "2525"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "附加到进程",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

#### 3. 添加调试任务

创建 `.vscode/tasks.json`：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "启动邮件服务器(调试模式)",
      "type": "shell",
      "command": "npm",
      "args": ["run", "debug"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "停止邮件服务器",
      "type": "shell",
      "command": "pkill",
      "args": ["-f", "node.*server.js"],
      "group": "build"
    }
  ]
}
```

#### 4. 远程调试工作流

```bash
# 1. 连接到远程服务器
# VS Code -> Remote-SSH: Connect to Host

# 2. 打开项目文件夹
# File -> Open Folder -> /path/to/mail-server

# 3. 设置断点
# 在代码行号左侧点击

# 4. 启动调试
# F5 或 Debug -> Start Debugging

# 5. 触发邮件处理
# 发送测试邮件或调用API
```

## 📝 日志调试

### 方案概述

通过详细的日志记录进行问题诊断，适合生产环境。

### 配置高级日志

#### 1. 安装日志库

```bash
npm install winston winston-daily-rotate-file
```

#### 2. 创建日志配置

创建 `utils/logger.js`：

```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 日志级别
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// 日志颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// 日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// 文件传输配置
const transports = [
  // 控制台输出
  new winston.transports.Console(),
  
  // 错误日志文件
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    handleExceptions: true,
    maxSize: '20m',
    maxFiles: '14d'
  }),
  
  // 所有日志文件
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
  }),
  
  // SMTP服务器专用日志
  new DailyRotateFile({
    filename: 'logs/smtp-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false
});

module.exports = logger;
```

#### 3. 在邮件服务器中使用日志

修改 `mail-server/smtp-server.js`：

```javascript
const logger = require('../utils/logger');

class DomainSMTPServer {
  // 验证用户认证
  async authenticateUser(username, password) {
    logger.info(`SMTP认证尝试: ${username}`);
    
    try {
      const user = await this.validateCredentials(username, password);
      if (user) {
        logger.info(`SMTP认证成功: ${username}`, {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString()
        });
        return user;
      } else {
        logger.warn(`SMTP认证失败: ${username}`, {
          reason: 'Invalid credentials',
          timestamp: new Date().toISOString()
        });
        return false;
      }
    } catch (error) {
      logger.error(`SMTP认证错误: ${username}`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // 处理邮件数据
  async processEmailData(emailData, session) {
    const startTime = Date.now();
    
    logger.info('开始处理邮件', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      size: emailData.size,
      messageId: emailData.messageId
    });

    try {
      // 邮件处理逻辑
      const result = await this.saveEmail(emailData);
      
      const processingTime = Date.now() - startTime;
      logger.info('邮件处理完成', {
        emailId: result.emailId,
        processingTime: `${processingTime}ms`,
        success: true
      });
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('邮件处理失败', {
        error: error.message,
        stack: error.stack,
        processingTime: `${processingTime}ms`,
        emailData: {
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject
        }
      });
      throw error;
    }
  }
}
```

#### 4. API请求日志中间件

创建 `middleware/requestLogger.js`：

```javascript
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.http(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // 记录响应
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger[logLevel](`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      ip: req.ip
    });
  });

  next();
}

module.exports = requestLogger;
```

在 `server.js` 中使用：

```javascript
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);
```

#### 5. 日志查看脚本

创建 `scripts/view-logs.sh`：

```bash
#!/bin/bash

# 日志查看脚本
LOG_DIR="logs"

show_help() {
    echo "邮件服务器日志查看工具"
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -e, --error     显示错误日志"
    echo "  -s, --smtp      显示SMTP日志"
    echo "  -a, --all       显示所有日志"
    echo "  -f, --follow    实时跟踪日志"
    echo "  -t, --tail N    显示最后N行"
    echo "  -h, --help      显示帮助"
}

# 默认参数
LOG_TYPE="combined"
TAIL_LINES=100
FOLLOW=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--error)
            LOG_TYPE="error"
            shift
            ;;
        -s|--smtp)
            LOG_TYPE="smtp"
            shift
            ;;
        -a|--all)
            LOG_TYPE="all"
            shift
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -t|--tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 获取最新日志文件
get_latest_log() {
    local log_pattern="$1"
    ls -t ${LOG_DIR}/${log_pattern}-*.log 2>/dev/null | head -1
}

# 显示日志
case $LOG_TYPE in
    "error")
        LOG_FILE=$(get_latest_log "error")
        ;;
    "smtp")
        LOG_FILE=$(get_latest_log "smtp")
        ;;
    "combined")
        LOG_FILE=$(get_latest_log "combined")
        ;;
    "all")
        echo "=== 错误日志 ==="
        tail -n 20 $(get_latest_log "error") 2>/dev/null
        echo -e "\n=== SMTP日志 ==="
        tail -n 20 $(get_latest_log "smtp") 2>/dev/null
        echo -e "\n=== 综合日志 ==="
        tail -n 20 $(get_latest_log "combined") 2>/dev/null
        exit 0
        ;;
esac

if [[ -z "$LOG_FILE" ]]; then
    echo "未找到日志文件"
    exit 1
fi

echo "查看日志文件: $LOG_FILE"

if [[ "$FOLLOW" == true ]]; then
    tail -f "$LOG_FILE"
else
    tail -n "$TAIL_LINES" "$LOG_FILE"
fi
```

使用方法：

```bash
chmod +x scripts/view-logs.sh

# 查看错误日志
./scripts/view-logs.sh --error

# 实时跟踪SMTP日志
./scripts/view-logs.sh --smtp --follow

# 查看最后50行综合日志
./scripts/view-logs.sh --tail 50
```

#### 6. 日志分析脚本

创建 `scripts/analyze-logs.py`：

```python
#!/usr/bin/env python3
"""
邮件服务器日志分析工具
"""

import json
import re
import sys
import argparse
from datetime import datetime
from collections import defaultdict, Counter

class LogAnalyzer:
    def __init__(self, log_file):
        self.log_file = log_file
        self.email_stats = defaultdict(int)
        self.error_stats = Counter()
        self.performance_stats = []

    def parse_logs(self):
        """解析日志文件"""
        with open(self.log_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    # 尝试解析JSON格式日志
                    if line.strip().startswith('{'):
                        log_data = json.loads(line.strip())
                        self.process_json_log(log_data)
                    else:
                        # 解析文本格式日志
                        self.process_text_log(line.strip())
                except (json.JSONDecodeError, Exception):
                    continue

    def process_json_log(self, log_data):
        """处理JSON格式日志"""
        level = log_data.get('level', '')
        message = log_data.get('message', '')
        
        if 'SMTP认证成功' in message:
            self.email_stats['successful_auth'] += 1
        elif 'SMTP认证失败' in message:
            self.email_stats['failed_auth'] += 1
        elif '邮件处理完成' in message:
            self.email_stats['processed_emails'] += 1
            # 记录处理时间
            if 'processingTime' in str(log_data):
                try:
                    time_str = re.search(r'(\d+)ms', str(log_data))
                    if time_str:
                        self.performance_stats.append(int(time_str.group(1)))
                except:
                    pass
        elif level == 'error':
            self.error_stats[message] += 1

    def process_text_log(self, line):
        """处理文本格式日志"""
        if 'SMTP认证成功' in line:
            self.email_stats['successful_auth'] += 1
        elif 'SMTP认证失败' in line:
            self.email_stats['failed_auth'] += 1
        elif '邮件处理完成' in line:
            self.email_stats['processed_emails'] += 1

    def generate_report(self):
        """生成分析报告"""
        print("=== 邮件服务器日志分析报告 ===\n")
        
        # 邮件统计
        print("📧 邮件处理统计:")
        print(f"  成功认证: {self.email_stats['successful_auth']}")
        print(f"  认证失败: {self.email_stats['failed_auth']}")
        print(f"  处理邮件: {self.email_stats['processed_emails']}")
        
        # 性能统计
        if self.performance_stats:
            avg_time = sum(self.performance_stats) / len(self.performance_stats)
            max_time = max(self.performance_stats)
            min_time = min(self.performance_stats)
            
            print(f"\n⚡ 性能统计:")
            print(f"  平均处理时间: {avg_time:.2f}ms")
            print(f"  最大处理时间: {max_time}ms")
            print(f"  最小处理时间: {min_time}ms")
        
        # 错误统计
        if self.error_stats:
            print(f"\n❌ 错误统计 (前5项):")
            for error, count in self.error_stats.most_common(5):
                print(f"  {error[:60]}...: {count}次")

def main():
    parser = argparse.ArgumentParser(description='邮件服务器日志分析工具')
    parser.add_argument('log_file', help='日志文件路径')
    
    args = parser.parse_args()
    
    analyzer = LogAnalyzer(args.log_file)
    analyzer.parse_logs()
    analyzer.generate_report()

if __name__ == '__main__':
    main()
```

使用方法：

```bash
# 分析今天的日志
python3 scripts/analyze-logs.py logs/combined-$(date +%Y-%m-%d).log

# 分析SMTP日志
python3 scripts/analyze-logs.py logs/smtp-$(date +%Y-%m-%d).log
```

## 🐳 Docker远程调试

### 方案概述

对运行在Docker容器中的邮件服务器进行调试。

### Docker调试配置

#### 1. 修改Dockerfile

```dockerfile
FROM node:16-alpine

# 安装调试工具
RUN apk add --no-cache curl

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖（包括开发依赖用于调试）
RUN npm install

# 复制源代码
COPY . .

# 暴露调试端口
EXPOSE 3000 25 143 9229

# 创建调试启动脚本
RUN echo '#!/bin/sh\nif [ "$NODE_ENV" = "debug" ]; then\n  exec node --inspect=0.0.0.0:9229 server.js\nelse\n  exec node server.js\nfi' > /app/start.sh && \
    chmod +x /app/start.sh

# 设置默认命令
CMD ["/app/start.sh"]
```

#### 2. 修改docker-compose.yml

```yaml
version: '3.8'

services:
  mail-server:
    build: .
    container_name: domain-mail-server
    ports:
      - "3000:3000"
      - "25:25" 
      - "143:143"
      - "9229:9229"  # 调试端口
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - .:/app  # 开发时挂载源码
    environment:
      - NODE_ENV=debug  # 启用调试模式
      - PORT=3000
      - SMTP_PORT=25
      - IMAP_PORT=143
      - SERVER_HOSTNAME=mail.yourdomain.com
    restart: unless-stopped
    
  # 调试工具容器
  debug-tools:
    image: node:16-alpine
    container_name: mail-debug-tools
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: tail -f /dev/null
    profiles: ["debug"]  # 只在调试时启动
```

#### 3. 调试脚本

创建 `docker-debug.sh`：

```bash
#!/bin/bash

echo "=== Docker远程调试设置 ==="

# 检查Docker和docker-compose
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: docker-compose未安装"
    exit 1
fi

# 函数：启动调试模式
start_debug() {
    echo "启动调试模式..."
    
    # 停止现有容器
    docker-compose down
    
    # 启动调试模式
    NODE_ENV=debug docker-compose up -d
    
    echo "容器启动完成，调试端口: 9229"
    echo "Chrome DevTools: chrome://inspect"
    echo "添加目标: localhost:9229"
}

# 函数：查看日志
view_logs() {
    echo "查看容器日志..."
    docker-compose logs -f mail-server
}

# 函数：进入容器
enter_container() {
    echo "进入容器..."
    docker-compose exec mail-server sh
}

# 函数：停止调试
stop_debug() {
    echo "停止调试模式..."
    docker-compose down
}

# 显示菜单
show_menu() {
    echo ""
    echo "选择操作:"
    echo "1) 启动调试模式"
    echo "2) 查看日志"
    echo "3) 进入容器"
    echo "4) 停止调试"
    echo "5) 退出"
    echo ""
    read -p "请选择 [1-5]: " choice
    
    case $choice in
        1) start_debug ;;
        2) view_logs ;;
        3) enter_container ;;
        4) stop_debug ;;
        5) exit 0 ;;
        *) echo "无效选择" ;;
    esac
}

# 主循环
while true; do
    show_menu
done
```

#### 4. VS Code容器调试配置

`.vscode/launch.json` 添加容器调试配置：

```json
{
  "name": "Docker容器调试",
  "type": "node",
  "request": "attach",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app",
  "protocol": "inspector",
  "restart": true
}
```

## 📊 监控调试

### 方案概述

通过监控工具进行性能调试和问题诊断。

### 性能监控

#### 1. 添加性能监控中间件

创建 `middleware/performance.js`：

```javascript
const logger = require('../utils/logger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      averageResponseTime: 0,
      emailsProcessed: 0,
      memoryUsage: []
    };
    
    // 定期收集系统指标
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // 每30秒收集一次
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memoryUsage.push({
      timestamp: new Date().toISOString(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    });
    
    // 只保留最近100条记录
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }
    
    logger.info('系统指标', {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime()
    });
  }

  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responses++;
        
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
        
        // 计算平均响应时间
        this.metrics.averageResponseTime = 
          (this.metrics.averageResponseTime * (this.metrics.responses - 1) + responseTime) / 
          this.metrics.responses;
        
        // 记录慢请求
        if (responseTime > 1000) {
          logger.warn('慢请求检测', {
            url: req.originalUrl,
            method: req.method,
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode
          });
        }
      });
      
      next();
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentMemory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

const monitor = new PerformanceMonitor();

module.exports = monitor;
```

#### 2. 添加监控端点

在 `routes/admin.js` 中添加：

```javascript
const performanceMonitor = require('../middleware/performance');

// 系统监控端点
router.get('/monitoring', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      }
    }
  });
});

// 健康检查端点
router.get('/health', async (req, res) => {
  try {
    // 检查数据库连接
    const db = getDB();
    await new Promise((resolve, reject) => {
      db.get('SELECT 1', [], (err) => {
        if (err) reject(err);
        else resolve();
      });
      db.close();
    });
    
    // 检查内存使用
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        usage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        percentage: `${memPercentage.toFixed(2)}%`,
        status: memPercentage > 90 ? 'warning' : 'ok'
      },
      database: 'connected',
      services: {
        smtp: process.env.SMTP_STATUS || 'unknown',
        imap: process.env.IMAP_STATUS || 'unknown'
      }
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

#### 3. 监控仪表板

在管理界面添加监控页面，修改 `public/app.js`：

```javascript
// 添加监控标签页
tabs: [
  // ... 其他标签页
  { id: 'monitoring', name: '系统监控', icon: 'fas fa-chart-line' }
],

// 添加监控数据
monitoring: {
  metrics: {},
  health: {},
  refreshInterval: null
},

methods: {
  // 加载监控数据
  async loadMonitoring() {
    try {
      const [metricsRes, healthRes] = await Promise.all([
        this.apiCall('GET', '/admin/monitoring'),
        this.apiCall('GET', '/admin/health')
      ]);
      
      this.monitoring.metrics = metricsRes.data.data;
      this.monitoring.health = healthRes.data;
    } catch (error) {
      console.error('加载监控数据失败:', error);
    }
  },

  // 开始监控刷新
  startMonitoring() {
    this.loadMonitoring();
    this.monitoring.refreshInterval = setInterval(() => {
      this.loadMonitoring();
    }, 5000); // 每5秒刷新
  },

  // 停止监控刷新
  stopMonitoring() {
    if (this.monitoring.refreshInterval) {
      clearInterval(this.monitoring.refreshInterval);
      this.monitoring.refreshInterval = null;
    }
  }
}
```

### 邮件处理监控

#### 1. 邮件处理性能跟踪

修改 `mail-server/smtp-server.js`：

```javascript
const performanceMonitor = require('../middleware/performance');

class DomainSMTPServer {
  async saveEmail(emailData) {
    const startTime = Date.now();
    const db = getDB();
    
    try {
      // 邮件保存逻辑
      const emailId = await this.performEmailSave(emailData);
      
      const processingTime = Date.now() - startTime;
      
      // 更新监控指标
      performanceMonitor.metrics.emailsProcessed++;
      
      logger.info('邮件保存完成', {
        emailId,
        processingTime: `${processingTime}ms`,
        size: emailData.size,
        from: emailData.from,
        to: emailData.to
      });
      
      return emailId;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('邮件保存失败', {
        error: error.message,
        processingTime: `${processingTime}ms`,
        emailData: {
          from: emailData.from,
          to: emailData.to,
          size: emailData.size
        }
      });
      
      throw error;
    } finally {
      db.close();
    }
  }
}
```

## 🔨 调试工具和技巧

### 1. 内存泄漏检测

创建 `scripts/memory-leak-detector.js`：

```javascript
#!/usr/bin/env node

const http = require('http');

class MemoryLeakDetector {
  constructor(interval = 10000) {
    this.interval = interval;
    this.baseline = null;
    this.samples = [];
  }

  start() {
    console.log('开始内存泄漏检测...');
    
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const sample = {
        timestamp: new Date().toISOString(),
        ...memUsage
      };
      
      this.samples.push(sample);
      
      if (!this.baseline) {
        this.baseline = memUsage;
        console.log('基准内存使用:', this.formatMemory(memUsage));
        return;
      }
      
      // 检测内存增长
      const growth = {
        rss: memUsage.rss - this.baseline.rss,
        heapUsed: memUsage.heapUsed - this.baseline.heapUsed,
        heapTotal: memUsage.heapTotal - this.baseline.heapTotal
      };
      
      console.log(`内存使用 [${sample.timestamp}]:`, this.formatMemory(memUsage));
      console.log('相对增长:', this.formatMemory(growth));
      
      // 如果内存增长超过阈值，发出警告
      if (growth.heapUsed > 50 * 1024 * 1024) { // 50MB
        console.warn('⚠️ 检测到可能的内存泄漏！');
        this.generateReport();
      }
      
      // 只保留最近50个样本
      if (this.samples.length > 50) {
        this.samples = this.samples.slice(-50);
      }
      
    }, this.interval);
  }

  formatMemory(mem) {
    return {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
    };
  }

  generateReport() {
    console.log('\n=== 内存使用报告 ===');
    console.log('基准内存:', this.formatMemory(this.baseline));
    console.log('当前内存:', this.formatMemory(this.samples[this.samples.length - 1]));
    
    // 分析趋势
    if (this.samples.length >= 10) {
      const recent = this.samples.slice(-10);
      const trend = this.analyzeTrend(recent);
      console.log('内存趋势:', trend);
    }
  }

  analyzeTrend(samples) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    
    const growth = (last.heapUsed - first.heapUsed) / first.heapUsed * 100;
    
    if (growth > 20) {
      return '📈 快速增长 (可能存在内存泄漏)';
    } else if (growth > 5) {
      return '📊 缓慢增长 (需要关注)';
    } else if (growth < -5) {
      return '📉 内存释放';
    } else {
      return '➡️ 稳定';
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const detector = new MemoryLeakDetector(5000); // 每5秒检测一次
  detector.start();
  
  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n正在生成最终报告...');
    detector.generateReport();
    process.exit(0);
  });
}

module.exports = MemoryLeakDetector;
```

### 2. 网络连接监控

创建 `scripts/connection-monitor.sh`：

```bash
#!/bin/bash

echo "=== 邮件服务器连接监控 ==="

# 监控端口连接
monitor_connections() {
    echo "当前连接统计:"
    echo "SMTP (端口25):"
    netstat -an | grep :25 | wc -l
    
    echo "IMAP (端口143):"
    netstat -an | grep :143 | wc -l
    
    echo "Web管理 (端口3000):"
    netstat -an | grep :3000 | wc -l
    
    echo ""
    echo "详细连接信息:"
    netstat -tulnp | grep -E ':(25|143|3000)'
}

# 监控进程
monitor_processes() {
    echo "Node.js进程:"
    ps aux | grep node | grep -v grep
    
    echo ""
    echo "邮件服务器进程资源使用:"
    ps -o pid,ppid,cmd,%mem,%cpu -C node
}

# 监控磁盘空间
monitor_disk() {
    echo "磁盘使用情况:"
    df -h
    
    echo ""
    echo "邮件数据目录:"
    du -sh data/ logs/ 2>/dev/null || echo "数据目录不存在"
}

# 主监控循环
main() {
    while true; do
        clear
        echo "=== 邮件服务器监控 $(date) ==="
        echo ""
        
        monitor_connections
        echo "================================"
        monitor_processes
        echo "================================"
        monitor_disk
        
        echo ""
        echo "按Ctrl+C退出监控"
        sleep 5
    done
}

# 检查参数
case "${1:-monitor}" in
    "connections")
        monitor_connections
        ;;
    "processes")
        monitor_processes
        ;;
    "disk")
        monitor_disk
        ;;
    "monitor")
        main
        ;;
    *)
        echo "用法: $0 [connections|processes|disk|monitor]"
        exit 1
        ;;
esac
```

## 🚨 常见问题和解决方案

### 1. 调试端口无法连接

**问题**: Chrome DevTools无法连接到远程调试端口

**解决方案**:
```bash
# 检查端口是否开放
netstat -tulnp | grep 9229

# 检查防火墙
sudo ufw status
sudo ufw allow 9229/tcp

# 检查SSH隧道
ps aux | grep ssh | grep 9229
```

### 2. 容器调试问题

**问题**: Docker容器中的Node.js调试器无法访问

**解决方案**:
```yaml
# docker-compose.yml
services:
  mail-server:
    # 确保调试端口绑定到0.0.0.0
    command: node --inspect=0.0.0.0:9229 server.js
    ports:
      - "9229:9229"
```

### 3. 性能问题调试

**问题**: 邮件处理缓慢

**调试步骤**:
```bash
# 1. 检查系统资源
htop
iotop

# 2. 分析慢查询
sqlite3 data/mail_server.db ".timer on" "SELECT * FROM emails LIMIT 10;"

# 3. 检查网络延迟
ping your-smtp-server
traceroute your-smtp-server

# 4. 分析日志
grep "处理时间" logs/combined-$(date +%Y-%m-%d).log | sort -k5 -nr
```

## 📚 参考资源

### 官方文档
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)

### 调试工具
- **ndb**: 改进的Node.js调试器
- **clinic.js**: Node.js性能分析工具
- **0x**: 火焰图生成工具

### 监控工具
- **PM2**: 进程管理和监控
- **New Relic**: APM监控
- **DataDog**: 基础设施监控

## 🎯 最佳实践

1. **开发环境**: 使用VS Code Remote或SSH隧道进行实时调试
2. **测试环境**: 使用详细日志和性能监控
3. **生产环境**: 仅使用日志调试，避免暴露调试端口
4. **安全性**: 始终通过VPN或SSH隧道访问调试端口
5. **性能**: 定期监控内存使用和响应时间
6. **日志管理**: 使用日志轮换和分析工具

---

通过本指南，您可以有效地对远程部署的域名邮件服务器进行调试和监控，确保系统稳定运行并快速定位问题。 