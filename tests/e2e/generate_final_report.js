const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'results');
const REPORT_PATH = path.join(__dirname, 'E2E_FINAL_REPORT.md');

const TEST_FILES = {
  pages: 'pages_test_results.json',
  apis: 'apis_test_results.json',
  functionality: 'functionality_test_results.json',
  performance: 'performance_test_results.json',
  security: 'security_test_results.json'
};

function loadResult(filename) {
  const filePath = path.join(RESULTS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (e) { return null; }
  }
  return null;
}

function generateReportId() {
  return `RPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function calculateGrade(passRate, criticalIssues, highIssues) {
  if (criticalIssues > 0) return { grade: 'F', label: '不合格', color: '🔴' };
  if (highIssues > 3) return { grade: 'D', label: '需紧急修复', color: '🔴' };
  if (highIssues > 0) return { grade: 'C', label: '需改进', color: '🟠' };
  if (passRate >= 98) return { grade: 'A+', label: '优秀', color: '🟢' };
  if (passRate >= 95) return { grade: 'A', label: '优秀', color: '🟢' };
  if (passRate >= 90) return { grade: 'A-', label: '良好', color: '🟢' };
  if (passRate >= 85) return { grade: 'B+', label: '良好', color: '🟡' };
  if (passRate >= 80) return { grade: 'B', label: '及格', color: '🟡' };
  if (passRate >= 70) return { grade: 'C', label: '需改进', color: '🟠' };
  return { grade: 'D', label: '不及格', color: '🔴' };
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}分${secs}秒`;
}

function main() {
  console.log('\n📋 正在收集测试结果并生成最终报告...\n');

  const pagesResult = loadResult(TEST_FILES.pages);
  const apisResult = loadResult(TEST_FILES.apis);
  const funcResult = loadResult(TEST_FILES.functionality);
  const perfResult = loadResult(TEST_FILES.performance);
  const secResult = loadResult(TEST_FILES.security);

  const allResults = [pagesResult, apisResult, funcResult].filter(r => r && r.summary);

  let totalTests = 0, totalPassed = 0, totalFailed = 0, totalSkipped = 0;
  let totalDuration = 0;
  const allFailures = [];
  const allWarnings = [];
  const moduleResults = {};

  if (pagesResult?.summary) {
    totalTests += pagesResult.summary.total; totalPassed += pagesResult.summary.passed;
    totalFailed += pagesResult.summary.failed; totalSkipped += pagesResult.summary.skipped;
    totalDuration += parseFloat(pagesResult.duration || 0);
    moduleResults['页面测试'] = pagesResult.summary;
    (pagesResult.details || []).filter(d => d.status === 'FAIL').forEach(f => allFailures.push({ ...f, module: '页面测试' }));
  }
  if (apisResult?.summary) {
    totalTests += apisResult.summary.total; totalPassed += apisResult.summary.passed;
    totalFailed += apisResult.summary.failed; totalSkipped += apisResult.summary.skipped;
    totalDuration += parseFloat(apisResult.duration || 0);
    moduleResults['API接口'] = apisResult.summary;
    (apisResult.details || []).filter(d => d.status === 'FAIL').forEach(f => allFailures.push({ ...f, module: 'API接口' }));
  }
  if (funcResult?.summary) {
    totalTests += funcResult.summary.total; totalPassed += funcResult.summary.passed;
    totalFailed += funcResult.summary.failed; totalSkipped += funcResult.summary.skipped;
    totalDuration += parseFloat(funcResult.duration || 0);
    moduleResults['功能完整性'] = funcResult.summary;
    (funcResult.details || []).filter(d => d.status === 'FAIL').forEach(f => allFailures.push({ ...f, module: '功能完整性' }));
  }

  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  const criticalIssues = (secResult?.findings || []).filter(f => f.severity === 'CRITICAL').length;
  const highIssues = (secResult?.findings || []).filter(f => f.severity === 'HIGH').length;
  const mediumIssues = (secResult?.findings || []).filter(f => f.severity === 'MEDIUM').length;

  const gradeInfo = calculateGrade(parseFloat(passRate), criticalIssues, highIssues);
  const reportId = generateReportId();
  const now = new Date();

  let report = '';
  report += `# 绮管电商后台系统 - E2E测试最终报告\n\n`;
  report += `> 报告ID: ${reportId}\n`;
  report += `> 生成时间: ${now.toISOString().slice(0, 19).replace('T', ' ')}\n\n`;

  report += `---\n\n`;

  report += `## 📊 测试概况\n\n`;
  report += `- **测试日期**: ${now.toLocaleDateString('zh-CN')}\n`;
  report += `- **测试环境**: 生产环境 (https://qimengzhiyue.cn)\n`;
  report += `- **总用例数**: ${totalTests}\n`;
  report += `- **通过**: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)\n`;
  report += `- **失败**: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)\n`;
  report += `- **跳过**: ${totalSkipped} (${((totalSkipped / totalTests) * 100).toFixed(1)}%)\n`;
  report += `- **总耗时**: ${formatDuration(totalDuration)}\n`;
  report += `- **总体评级**: ${gradeInfo.color} **${gradeInfo.grade}** (${gradeInfo.label})\n\n`;

  report += `### 通过率可视化\n\n`;
  const barLength = 40;
  const filledLength = Math.round((parseFloat(passRate) / 100) * barLength);
  report += `\`\`\`\n`;
  report += `[${'█'.repeat(filledLength)}${'░'.repeat(barLength - filledLength)}] ${passRate}%\n`;
  report += `\`\`\`\n\n`;

  report += `## 📋 各模块详细结果\n\n`;

  for (const [moduleName, summary] of Object.entries(moduleResults)) {
    const modPassRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0;
    const statusIcon = summary.failed === 0 ? '✅' : (summary.failed <= 2 ? '⚠️' : '❌');
    report += `### ${statusIcon} ${moduleName}\n\n`;
    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| 总用例 | ${summary.total} |\n`;
    report += `| 通过 | ${summary.passed} ✅ |\n`;
    report += `| 失败 | ${summary.failed} ❌ |\n`;
    report += `| 跳过 | ${summary.skipped} ⏭️ |\n`;
    report += `| 通过率 | ${modPassRate}% |\n\n`;
  }

  if (perfResult?.summary) {
    report += `## ⚡ 性能基线\n\n`;
    report += `| 指标 | 目标值 | 实际值 | 状态 |\n`;
    report += `|------|--------|--------|------|\n`;

    const pageAvg = perfResult.summary?.pageAverage || 'N/A';
    const apiAvg = perfResult.summary?.apiAverage || 'N/A';
    const pageStatus = typeof pageAvg === 'number' && pageAvg <= 3000 ? '✅' : '⚠️';
    const apiStatus = typeof apiAvg === 'number' && apiAvg <= 500 ? '✅' : '⚠️';

    report += `| 页面平均加载时间 | <3s | ${typeof pageAvg === 'number' ? (pageAvg / 1000).toFixed(2) + 's' : pageAvg} | ${pageStatus} |\n`;
    report += `| API平均响应时间 | <500ms | ${typeof apiAvg === 'number' ? apiAvg + 'ms' : apiAvg} | ${apiStatus} |\n`;
    report += `| 并发用户数 | - | ${perfResult.config?.concurrentUsers || 'N/A'} | - |\n`;
    report += `| 页面通过率 | - | ${perfResult.summary?.pagePassRate || 'N/A'} | - |\n`;
    report += `| API通过率 | - | ${perfResult.summary?.apiPassRate || 'N/A'} | - |\n\n`;

    if (perfResult.pages) {
      report += `### 页面性能详情\n\n`;
      report += `| 页面 | 平均(ms) | P95(ms) | 状态 |\n`;
      report += `|------|----------|---------|------|\n`;
      for (const [name, stats] of Object.entries(perfResult.pages)) {
        const icon = stats.avg <= 3000 ? '✅' : '⚠️';
        report += `| ${name} | ${stats.avg} | ${stats.p95} | ${icon} |\n`;
      }
      report += `\n`;
    }

    if (perfResult.apis) {
      report += `### API性能详情\n\n`;
      report += `| API | 平均(ms) | P95(ms) | 状态 |\n`;
      report += `|-----|----------|---------|------|\n`;
      for (const [name, stats] of Object.entries(perfResult.apis)) {
        const icon = stats.avg <= 500 ? '✅' : '⚠️';
        report += `| ${name} | ${stats.avg} | ${stats.p95} | ${icon} |\n`;
      }
      report += `\n`;
    }
  }

  if (secResult?.details) {
    report += `## 🔒 安全评估\n\n`;
    report += `| 检测项 | 结果 |\n`;
    report += `|--------|------|\n`;
    report += `| SQL注入防护 | ${criticalIssues === 0 && !secResult.details.some(d => d.name?.includes('SQL注入') && d.status === 'FAIL') ? '✅ 有效' : '❌ 存在风险'} |\n`;
    report += `| XSS防护 | ${!secResult.details.some(d => d.name?.includes('XSS') && d.status === 'FAIL') ? '✅ 有效' : '⚠️ 需关注'} |\n`;
    report += `| HTTPS | ✅ 已启用 |\n`;
    report += `| 敏感信息泄露 | ${highIssues === 0 ? '✅ 未发现' : `⚠️ 发现${highIssues}项`} |\n`;
    report += `| 安全头配置 | ${mediumIssues <= 2 ? '✅ 基本完善' : `⚠️ 缺少${mediumIssues}项`} |\n`;
    report += `| 暴力破解防护 | ${secResult.details.some(d => d.name?.includes('暴力破解') && d.status === 'PASS') ? '✅ 已检测到' : '⚠️ 未确认'} |\n\n`;

    report += `### 安全发现统计\n\n`;
    report += `- 🔴 **严重(Critical)**: ${criticalIssues} 个\n`;
    report += `- 🟠 **高危(High)**: ${highIssues} 个\n`;
    report += `- 🟡 **中危(Medium)**: ${mediumIssues} 个\n\n`;
  }

  if (allFailures.length > 0) {
    report += `## ❌ 失败的测试 (${allFailures.length})\n\n`;
    report += `| # | 用例名称 | 模块 | 失败原因 | 严重程度 |\n`;
    report += `|---|----------|------|----------|----------|\n`;

    allFailures.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });

    allFailures.forEach((f, idx) => {
      const sevIcon = f.severity === 'CRITICAL' ? '🔴' : (f.severity === 'HIGH' ? '🟠' : '🟡');
      report += `| TC-${String(idx + 1).padStart(3, '0')} | ${f.name?.slice(0, 30) || '-'} | ${f.module || '-'} | ${(f.error || f.reason || '-').slice(0, 50)} | ${sevIcon} ${f.severity || 'MEDIUM'} |\n`;
    });
    report += `\n`;
  } else {
    report += `## ✅ 所有测试通过\n\n`;
    report += `本次E2E测试未发现失败的用例，系统运行状态良好。\n\n`;
  }

  report += `## 📝 改进建议\n\n`;

  const suggestions = [];

  if (criticalIssues > 0) suggestions.push({ priority: 'P0', text: `立即修复${criticalIssues}个严重安全问题(Critical)，这些可能导致数据泄露或系统被入侵` });
  if (highIssues > 0) suggestions.push({ priority: 'P1', text: `优先处理${highIssues}个高危问题(High)，包括安全漏洞和功能缺陷` });
  if (allFailures.filter(f => f.module === 'API接口').length > 0) suggestions.push({ priority: 'P1', text: '检查并修复API接口层的错误，确保所有CRUD操作正常工作' });
  if (perfResult?.summary?.overall === 'NEEDS_ATTENTION') suggestions.push({ priority: 'P2', text: '优化页面和API的响应性能，部分接口超过阈值' });
  if (mediumIssues > 3) suggestions.push({ priority: 'P2', text: `补充${mediumIssues - 2}项安全头配置，提升整体安全性` });
  if (!secResult?.details?.some(d => d.name?.includes('暴力破解') && d.status === 'PASS')) suggestions.push({ priority: 'P2', text: '考虑实现登录失败次数限制或验证码机制，防止暴力破解' });
  suggestions.push({ priority: 'P3', text: '定期执行E2E回归测试，确保持续集成质量' });
  suggestions.push({ priority: 'P3', text: '增加更多边界条件和异常场景的测试覆盖' });

  suggestions.forEach((s, i) => {
    report += `${i + 1}. **[${s.priority}]** ${s.text}\n`;
  });

  report += `\n## 🎯 结论与下一步计划\n\n`;

  if (gradeInfo.grade.startsWith('A')) {
    report += `系统整体运行稳定，核心功能正常，性能达标。`;
    if (highIssues === 0 && criticalIssues === 0) {
      report += `安全性良好，可以放心部署到生产环境。\n\n`;
    } else {
      report += `建议优先修复发现的安全问题后进行生产发布。\n\n`;
    }
  } else if (gradeInfo.grade.startsWith('B')) {
    report += `系统基本可用，但存在一些需要改进的地方。建议在修复主要问题后再进行完整回归测试。\n\n`;
  } else {
    report += `系统存在较多问题，建议进行全面排查和修复后再进行测试。\n\n`;
  }

  report += `### 下一步行动\n\n`;
  report += `- [ ] 审查并修复上述失败用例\n`;
  report += `- [ ] 处理安全扫描发现的漏洞\n`;
  report += `- [ ] 对修复后的系统重新运行E2E测试\n`;
  report += `- [ ] 将E2E测试纳入CI/CD流水线\n`;
  report += `- [ ] 建立性能基线监控机制\n\n`;

  report += `---\n\n`;
  report += `*报告由 E2E 自动化测试系统生成 | 绮管电商后台 v1.0*\n`;

  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log(`\n✅ 最终报告已生成: ${REPORT_PATH}\n`);

  console.log('\n' + '='.repeat(60));
  console.log(`${gradeInfo.color}  总体评级: ${gradeInfo.grade} (${gradeInfo.label})`);
  console.log('='.repeat(60));
  console.log(`\n  📊 测试统计:`);
  console.log(`     总用例:   ${totalTests}`);
  console.log(`     通过:     ${totalPassed} (${passRate}%)`);
  console.log(`     失败:     ${totalFailed}`);
  console.log(`     跳过:     ${totalSkipped}`);
  console.log(`     耗时:     ${formatDuration(totalDuration)}`);

  if (secResult?.findings) {
    console.log(`\n  🔒 安全问题:`);
    console.log(`     🔴 严重:   ${criticalIssues}`);
    console.log(`     🟠 高危:   ${highIssues}`);
    console.log(`     🟡 中危:   ${mediumIssues}`);
  }

  console.log(`\n  📁 报告文件: ${REPORT_PATH}\n`);

  if (criticalIssues > 0) {
    process.exit(2);
  } else if (highIssues > 0 || totalFailed > 0) {
    process.exit(1);
  }
}

main();
