#!/usr/bin/env node

/**
 * ============================================================
 * 绮管后台 - SQLite → MySQL 数据迁移工具
 * 
 * 功能:
 * 1. 从SQLite数据库导出数据
 * 2. 转换为MySQL兼容的INSERT语句
 * 3. 可选择: 导出为SQL文件 或 直接导入到TDSQL-C
 * 
 * 使用方法:
 *   node migrate_to_mysql.js --export          # 导出为SQL文件
 *   node migrate_to_mysql.js --import           # 导入到MySQL
 *   node migrate_to_mysql.js --full             # 完整迁移(导出+导入)
 *   node migrate_to_mysql.js --dry-run          # 试运行(仅显示将执行的操作)
 * 
 * 环境要求:
 * - Node.js >= 14
 * - better-sqlite3 (已安装)
 * - mysql2 (需安装: npm install mysql2)
 * 
 * 作者: AI Assistant
 * 创建时间: 2026-04-08
 * ============================================================
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// 配置常量
const SQLITE_DB_PATH = path.join(__dirname, 'data', 'ecommerce.db');
const OUTPUT_SQL_FILE = path.join(__dirname, 'database', 'sqlite_export_data.sql');
const TABLES = ['categories', 'products', 'users', 'orders', 'order_items'];

// 颜色输出工具
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 初始化SQLite连接 (同步方式，使用better-sqlite3)
 */
function initSQLite() {
    try {
        const Database = require('better-sqlite3');
        const db = new Database(SQLITE_DB_PATH, { readonly: true });
        log(`✅ [SQLite] 连接成功: ${SQLITE_DB_PATH}`, 'green');
        return db;
    } catch (error) {
        log(`❌ [SQLite] 连接失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * 初始化MySQL连接 (异步方式，使用mysql2/promise)
 */
async function initMySQL() {
    try {
        const mysql = require('mysql2/promise');
        
        const connectionConfig = {
            host: process.env.DB_HOST || '10.0.0.16',
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'QMZYXCX',
            password: process.env.DB_PASSWORD || 'LJN040821.',
            database: process.env.DB_NAME || 'qmzyxcx',
            charset: process.env.DB_CHARSET || 'utf8mb4',
            timezone: process.env.DB_TIMEZONE || '+08:00',
            connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
            multipleStatements: true  // 允许执行多条SQL语句
        };

        const connection = await mysql.createConnection(connectionConfig);
        log(`✅ [MySQL/TDSQL-C] 连接成功: ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`, 'green');
        return connection;
    } catch (error) {
        log(`❌ [MySQL/TDSQL-C] 连接失败: ${error.message}`, 'red');
        log('   请检查 .env 文件中的数据库配置', 'yellow');
        process.exit(1);
    }
}

/**
 * 从SQLite表获取所有数据
 */
function exportTableData(sqliteDB, tableName) {
    try {
        const stmt = sqliteDB.prepare(`SELECT * FROM \`${tableName}\` ORDER BY id ASC`);
        const rows = stmt.all();
        
        if (!rows || rows.length === 0) {
            log(`⚠️  [${tableName}] 表中无数据`, 'yellow');
            return { tableName, columns: [], data: [], count: 0 };
        }
        
        // 获取列名
        const columns = Object.keys(rows[0]);
        
        log(`📦 [${tableName}] 导出 ${rows.length} 条记录 (${columns.length} 个字段)`, 'cyan');
        
        return { tableName, columns, data: rows, count: rows.length.length };
    } catch (error) {
        log(`❌ [${tableName}] 导出失败: ${error.message}`, 'red');
        return null;
    }
}

/**
 * 将数据转换为MySQL INSERT语句
 */
function convertToMySQLInsert(tableInfo) {
    if (!tableInfo || tableInfo.data.length === 0) return '';
    
    const { tableName, columns, data } = tableInfo;
    const sqlLines = [];
    
    // 添加注释头
    sqlLines.push('');
    sqlLines.push(`-- ============================================================`);
    sqlLines.push(`-- 表: ${tableName}`);
    sqlLines.push(`-- 记录数: ${data.length}`);
    sqlLines.push(`-- 导出时间: ${new Date().toISOString()}`);
    sqlLines.push(`-- 来源: SQLite ecommerce.db`);
    sqlLines.push(`-- ============================================================`);
    
    // 清空目标表数据（保持外键关系）
    sqlLines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
    sqlLines.push(`TRUNCATE TABLE \`${tableName}\`;`);
    sqlLines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    sqlLines.push('');
    
    // 批量生成INSERT语句 (每批100条)
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const valueList = batch.map(row => {
            const values = columns.map(col => {
                let value = row[col];
                
                // 处理NULL值
                if (value === null || value === undefined) {
                    return 'NULL';
                }
                
                // 处理字符串类型 (转义特殊字符)
                if (typeof value === 'string') {
                    // 转义单引号、反斜杠等特殊字符
                    value = value.replace(/'/g, "''");
                    value = value.replace(/\\/g, "\\\\");
                    return `'${value}'`;
                }
                
                // 处理数字类型
                if (typeof value === 'number') {
                    // 检查是否为NaN或Infinity
                    if (!Number.isFinite(value)) {
                        return 'NULL';
                    }
                    return value.toString();
                }
                
                // 其他类型转为JSON字符串
                if (typeof value === 'object') {
                    const jsonStr = JSON.stringify(value).replace(/'/g, "''");
                    return `'${jsonStr}'`;
                }
                
                return `'${value.toString()}'`;
            });
            
            return `(${values.join(', ')})`;
        });
        
        const columnNames = columns.map(col => `\`${col}\``).join(', ');
        const insertSQL = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES\n${valueList.join(',\n')};`;
        
        sqlLines.push(insertSQL);
        sqlLines.push('');
    }
    
    return sqlLines.join('\n');
}

/**
 * 导出所有表数据到SQL文件
 */
function exportAllToSQLFile(sqliteDB) {
    log('\n' + '='.repeat(60), 'blue');
    log('🔄 开始从SQLite导出数据...', 'blue');
    log('='.repeat(60) + '\n', 'blue');
    
    let allSQL = [];
    
    // 文件头部信息
    allSQL.push('-- ============================================================');
    allSQL.push('-- 绮管后台 - SQLite 数据导出文件');
    allSQL.push('-- 目标: MySQL / TDSQL-C');
    allSQL.push(`-- 导出时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    allSQL.push('-- 数据库源: SQLite (ecommerce.db)');
    allSQL.push('-- 兼容性: MySQL 5.7+, TDSQL-C');
    allSQL.push('-- ============================================================');
    allSQL.push('');
    allSQL.push('SET NAMES utf8mb4;');
    allSQL.push('SET FOREIGN_KEY_CHECKS = 0;');
    allSQL.push('');
    
    let totalRecords = 0;
    
    for (const table of TABLES) {
        const tableInfo = exportTableData(sqliteDB, table);
        if (tableInfo && tableInfo.data.length > 0) {
            const sql = convertToMySQLInsert(tableInfo);
            allSQL.push(sql);
            totalRecords += tableInfo.data.length;
        }
    }
    
    // 文件尾部
    allSQL.push('');
    allSQL.push('SET FOREIGN_KEY_CHECKS = 1;');
    allSQL.push('');
    allSQL.push('-- ============================================================');
    allSQL.push(`-- ✅ 导出完成! 共 ${totalRecords} 条记录`);
    allSQL.push('-- ============================================================');
    
    const finalSQL = allSQL.join('\n');
    
    // 写入文件
    fs.writeFileSync(OUTPUT_SQL_FILE, finalSQL, 'utf8');
    
    log('\n' + '='.repeat(60), 'green');
    log(`✅ 数据导出完成!`, 'green');
    log(`   📁 输出文件: ${OUTPUT_SQL_FILE}`, 'cyan');
    log(`   📊 总记录数: ${totalRecords}`, 'cyan');
    log(`   📏 文件大小: ${(Buffer.byteLength(finalSQL, 'utf8') / 1024).toFixed(2)} KB`, 'cyan');
    log('='.repeat(60) + '\n', 'green');
    
    return OUTPUT_SQL_FILE;
}

/**
 * 从SQL文件导入到MySQL
 */
async function importToMySQL(sqlFile, isDryRun = false) {
    log('\n' + '='.repeat(60), 'blue');
    log('🔄 开始导入数据到MySQL/TDSQL-C...', 'blue');
    log('='.repeat(60) + '\n', 'blue');
    
    if (!fs.existsSync(sqlFile)) {
        log(`❌ SQL文件不存在: ${sqlFile}`, 'red');
        return false;
    }
    
    const mysqlConnection = await initMySQL();
    
    try {
        // 读取SQL文件内容
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        if (isDryRun) {
            log('⚠️  [DRY-RUN] 试运行模式 - 不会实际执行SQL', 'yellow');
            log(`\n📋 将执行的SQL预览:\n`, 'cyan');
            
            // 显示前2000字符
            console.log(sqlContent.substring(0, 2000));
            if (sqlContent.length > 2000) {
                log(`\n... (省略 ${sqlContent.length - 2000} 字符)`, 'yellow');
            }
            
            log('\n✅ [DRY-RUN] 预览完成', 'green');
            return true;
        }
        
        // 执行SQL (使用multipleStatements选项)
        log('📤 正在执行SQL语句...', 'cyan');
        
        const startTime = Date.now();
        
        await mysqlConnection.query(sqlContent);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        log('\n' + '='.repeat(60), 'green');
        log(`✅ 数据导入成功!`, 'green');
        log(`   ⏱️  耗时: ${duration} 秒`, 'cyan');
        log(`   📄 SQL文件: ${sqlFile}`, 'cyan');
        log('='.repeat(60) + '\n', 'green');
        
        return true;
        
    } catch (error) {
        log(`\n❌ 导入失败: ${error.message}`, 'red');
        log(`   SQL状态: ${error.sqlState || 'N/A'}`, 'yellow');
        log(`   错误代码: ${error.errno || 'N/A'}`, 'yellow');
        
        if (error.sql) {
            log(`\n   问题SQL片段:`, 'yellow');
            log(`   ${error.sql.substring(0, 500)}...`, 'yellow');
        }
        
        return false;
    } finally {
        await mysqlConnection.end();
        log('🔌 [MySQL] 连接已关闭', 'cyan');
    }
}

/**
 * 完整迁移流程: 导出 → 导入
 */
async function fullMigration(isDryRun = false) {
    const sqliteDB = initSQLite();
    
    try {
        // 步骤1: 导出到SQL文件
        const sqlFile = exportAllToSQLFile(sqliteDB);
        
        if (!sqlFile) {
            log('❌ 导出失败，终止迁移', 'red');
            return;
        }
        
        // 步骤2: 导入到MySQL
        const success = await importToMySQL(sqlFile, isDryRun);
        
        if (success && !isDryRun) {
            log('\n🎉 迁移完成! 所有数据已成功从SQLite迁移到TDSQL-C!', 'green');
        }
        
    } finally {
        sqliteDB.close();
        log('🔌 [SQLite] 连接已关闭', 'cyan');
    }
}

/**
 * 主函数 - 解析命令行参数并执行
 */
async function main() {
    const args = process.argv.slice(2);
    
    console.log('\n' + '█'.repeat(60));
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█' + '  绮管后台 - SQLite → MySQL 数据迁移工具  '.padStart(40) + '█');
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█'.repeat(60) + '\n');
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        log('使用方法:', 'cyan');
        log('  node migrate_to_mysql.js --export     导出SQLite数据为SQL文件', 'reset');
        log('  node migrate_to_mysql.js --import      导入SQL文件到MySQL', 'reset');
        log('  node migrate_to_mysql.js --full        完整迁移(导出+导入)', 'reset');
        log('  node migrate_to_mysql.js --dry-run     试运行模式', 'reset');
        log('  node migrate_to_mysql.js --help        显示帮助信息', 'reset');
        log('', 'reset');
        log('示例:', 'yellow');
        log('  node migrate_to_mysql.js --export      # 仅导出', 'reset');
        log('  node migrate_to_mysql.js --full         # 完整迁移', 'reset');
        log('  node migrate_to_mysql.js --full --dry-run  # 测试迁移流程', 'reset');
        return;
    }
    
    const isDryRun = args.includes('--dry-run');
    
    try {
        if (args.includes('--export')) {
            const sqliteDB = initSQLite();
            try {
                exportAllToSQLFile(sqliteDB);
            } finally {
                sqliteDB.close();
            }
        } else if (args.includes('--import')) {
            await importToMySQL(OUTPUT_SQL_FILE, isDryRun);
        } else if (args.includes('--full')) {
            await fullMigration(isDryRun);
        } else {
            log('❌ 未知参数，请使用 --help 查看帮助', 'red');
        }
    } catch (error) {
        log(`\n💥 致命错误: ${error.message}`, 'red');
        log(error.stack, 'yellow');
        process.exit(1);
    }
}

// 执行主函数
main().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
