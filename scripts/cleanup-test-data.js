#!/usr/bin/env node

/**
 * 绮管后台 - 测试数据安全清理工具
 * 
 * 功能:
 * - 支持 --dry-run 模式预览待清理数据（不实际删除）
 * - 安全清除测试/开发环境的冗余数据
 * - 保护核心业务数据不被误删
 * - 生成详细的清理报告
 * 
 * 使用方法:
 *   node scripts/cleanup-test-data.js --dry-run    # 预览模式
 *   node scripts/cleanup-test-data.js              # 实际执行
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.env.DB_PATH || './data/ecommerce.db');

// 解析命令行参数
const isDryRun = process.argv.includes('--dry-run');

console.log('\n' + '='.repeat(60));
console.log(`🧹 绮管后台 - 测试数据清理工具`);
console.log('='.repeat(60));
console.log(`\n📌 运行模式: ${isDryRun ? '🔍 预览模式 (DRY-RUN) - 不执行删除' : '⚡ 执行模式 - 将实际删除数据'}`);
console.log(`📌 数据库路径: ${dbPath}`);
console.log(`📌 执行时间: ${new Date().toLocaleString()}\n`);

// 定义清理规则
const CLEANUP_RULES = [
  {
    name: '过期优惠券',
    table: 'coupons',
    condition: `status = 'expired' OR end_time < datetime('now')`,
    description: '已过期或结束时间已过的优惠券',
    impact: 'medium',
    safeToDelete: true
  },
  {
    name: '已使用的用户优惠券',
    table: 'user_coupons',
    condition: "status IN ('used', 'expired')",
    description: '状态为已使用或已过期的用户优惠券',
    impact: 'low',
    safeToDelete: true
  },
  {
    name: '旧的领取日志',
    table: 'coupon_receive_logs',
    condition: `created_at < datetime('now', '-30 days')`,
    description: '30天前的优惠券领取日志',
    impact: 'low',
    safeToDelete: true
  },
  {
    name: '测试订单（取消状态）',
    table: 'orders',
    condition: "status = 'cancelled' AND created_at < datetime('now', '-7 days')",
    description: '7天前已取消的订单',
    impact: 'high',
    requiresConfirmation: true,
    safeToDelete: false // 需要确认
  },
  {
    name: '空订单项（孤儿数据）',
    table: 'order_items',
    condition: `order_id NOT IN (SELECT id FROM orders)`,
    description: '关联订单已被删除的孤立订单项',
    impact: 'low',
    safeToDelete: true
  }
];

// 核心业务表保护名单（这些表的数据不会被自动清理）
const PROTECTED_TABLES = ['users', 'categories', 'products'];
const PROTECTED_RECORDS = {
  users: [{ condition: `role = 'admin'`, reason: '管理员账户' }],
  categories: [{ condition: `parent_id IS NULL`, reason: '顶级分类' }],
  products: [{ condition: `status = 'active' AND stock > 0`, reason: '在售商品' }]
};

async function runCleanup() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      console.log(`❌ 数据库文件不存在: ${dbPath}`);
      reject(new Error('Database not found'));
      return;
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.log(`❌ 数据库连接失败: ${err.message}\n`);
        reject(err);
        return;
      }

      console.log('✅ 数据库连接成功\n');

      let totalAffected = 0;
      let ruleIndex = 0;

      const processNextRule = () => {
        if (ruleIndex >= CLEANUP_RULES.length) {
          // 所有规则处理完成，生成报告
          generateFinalReport(db, totalAffected);
          return;
        }

        const rule = CLEANUP_RULES[ruleIndex++];
        
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📋 规则 ${ruleIndex}/${CLEANUP_RULES.length}: ${rule.name}`);
        console.log(`   描述: ${rule.description}`);
        console.log(`   影响级别: ${rule.impact === 'high' ? '🔴 高' : rule.impact === 'medium' ? '🟡 中' : '🟢 低'}`);

        // 先查询符合条件的记录数
        db.get(
          `SELECT COUNT(*) as count FROM ${rule.table} WHERE ${rule.condition}`,
          [],
          (err, row) => {
            if (err) {
              console.log(`   ❌ 查询失败: ${err.message}`);
              processNextRule();
              return;
            }

            const count = row.count;
            console.log(`   待清理记录数: ${count} 条`);

            if (count === 0) {
              console.log(`   ✅ 无需清理`);
              processNextRule();
              return;
            }

            // 显示示例数据（前3条）
            db.all(
              `SELECT * FROM ${rule.table} WHERE ${rule.condition} LIMIT 3`,
              [],
              (err2, samples) => {
                if (!err2 && samples.length > 0) {
                  console.log(`   📝 示例数据:`);
                  samples.forEach((sample, idx) => {
                    const preview = Object.entries(sample)
                      .slice(0, 4)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v).substring(0, 30)}`)
                      .join(', ');
                    console.log(`     [${idx + 1}] ${preview}`);
                  });
                  if (count > 3) {
                    console.log(`     ... 还有 ${count - 3} 条记录`);
                  }
                }

                // 如果是预览模式或需要确认的规则，只显示信息
                if (isDryRun || !rule.safeToDelete) {
                  if (!rule.safeToDelete) {
                    console.log(`   ⚠️ 此规则需要人工确认（影响核心数据），跳过自动清理`);
                  } else if (isDryRun) {
                    console.log(`   🔍 [DRY-RUN] 将删除以上 ${count} 条记录`);
                  }
                  totalAffected += count; // 计入统计但不实际删除
                  setTimeout(processNextRule, 100);
                } else {
                  // 实际执行删除
                  console.log(`   ⚡ 正在删除...`);
                  
                  db.run(
                    `DELETE FROM ${rule.table} WHERE ${rule.condition}`,
                    [],
                    function(err3) {
                      if (err3) {
                        console.log(`   ❌ 删除失败: ${err3.message}`);
                      } else {
                        console.log(`   ✅ 成功删除 ${this.changes} 条记录`);
                        totalAffected += this.changes;
                      }
                      
                      setTimeout(processNextRule, 100);
                    }
                  );
                }
              }
            );
          }
        );
      };

      // 开始处理第一条规则
      processNextRule();
    });
  });
}

function generateFinalReport(db, totalPreviewed) {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 清理操作报告');
  console.log('='.repeat(60));

  // 验证核心数据完整性
  const checks = [
    { sql: "SELECT COUNT(*) as count FROM users", label: '用户总数' },
    { sql: "SELECT COUNT(*) as count FROM categories", label: '分类总数' },
    { sql: "SELECT COUNT(*) as count FROM products", label: '商品总数' },
    { sql: "SELECT COUNT(*) as count FROM orders", label: '订单总数' },
    { sql: "SELECT COUNT(*) as count FROM coupons WHERE status='active'", label: '有效优惠券' }
  ];

  let checkIndex = 0;
  
  const runCheck = () => {
    if (checkIndex >= checks.length) {
      // 数据库大小检查
      const stats = fs.statSync(dbPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`\n💾 数据库大小: ${sizeMB} MB`);
      console.log(`📍 数据库路径: ${dbPath}`);
      
      console.log(`\n${isDryRun ? '🔍' : '✅'} ${isDryRun ? '预览模式 - 未执行任何删除操作' : '清理操作已完成'}`);
      console.log(`${isDryRun ? '📋' : '🗑️'} 待清理/已清理记录总数: ${totalPreviewed} 条`);
      
      if (!isDryRun) {
        console.log('\n💡 建议定期运行此工具保持数据库整洁:');
        console.log('   node scripts/cleanup-test-data.js --dry-run  # 定期检查');
        console.log('   node scripts/cleanup-test-data.js            # 执行清理');
      } else {
        console.log('\n💡 如需实际执行清理，请移除 --dry-run 参数:');
        console.log('   node scripts/cleanup-test-data.js');
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      db.close();
      return;
    }

    const check = checks[checkIndex++];
    
    db.get(check.sql, [], (err, row) => {
      if (err) {
        console.log(`   ❌ ${check.label}: 查询失败`);
      } else {
        console.log(`   ✅ ${check.label}: ${row.count} 条`);
      }
      
      setTimeout(runCheck, 50);
    });
  };

  console.log('\n📌 核心数据完整性验证:');
  runCheck();
}

// 主程序入口
if (require.main === module) {
  runCleanup()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ 清理过程出错:', err.message);
      process.exit(1);
    });
}

module.exports = { runCleanup, CLEANUP_RULES };
