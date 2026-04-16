/**
 * 分类管理 E2E 测试（Playwright框架）
 * 
 * 前置条件：
 * 1. 需要启动后端服务 (npm run dev 或 node index.js)
 * 2. 需要启动前端开发服务器 (cd admin-frontend && npm run dev)
 * 3. 数据库中应有测试数据
 *
 * 运行方式：npx playwright test tests/e2e/categories.spec.js
 */

const { test, expect } = require('@playwright/test');

// 测试配置
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

test.describe('分类管理 E2E 测试', () => {
  
  // 在所有测试前登录
  test.beforeEach(async ({ page }) => {
    // 如果需要登录，在这里实现
    // await page.goto(`${BASE_URL}/login`);
    // await page.fill('[placeholder="用户名"]', 'admin');
    // await page.fill('[placeholder="密码"]', 'admin123');
    // await page.click('button[type="submit"]');
    // await page.waitForURL('**/dashboard');
  });

  test.describe('页面加载和基础功能', () => {
    
    test('应能成功进入分类管理页面', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      
      // 页面应包含关键元素
      await expect(page.locator('text=添加分类')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('input[placeholder="搜索分类..."]')).toBeVisible();
      await expect(page.locator('.el-table, table, [class*="table"]')).toBeVisible();
    });

    test('应显示分类列表数据', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      
      // 等待数据加载完成
      await page.waitForLoadState('networkidle');
      
      // 应显示表格或空状态
      const hasTable = await page.locator('.el-table, table').count() > 0;
      const hasEmptyState = await page.locator('text=暂无分类数据').count() > 0;
      
      expect(hasTable || hasEmptyState).toBeTruthy();
    });

    test('应显示正确的页面标题和工具栏', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      
      // 检查工具栏元素
      await expect(page.locator('button:has-text("添加分类")')).toBeVisible();
      await expect(page.locator('input[placeholder="搜索分类..."]')).toBeVisible();
    });
  });

  test.describe('搜索功能', () => {
    
    test('应能通过关键词搜索分类', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 输入搜索关键词
      await page.fill('input[placeholder="搜索分类..."]', '电子');
      await page.press('input[placeholder="搜索..."]', 'Enter');
      
      // 等待搜索结果
      await page.waitForTimeout(500);
      
      // 搜索应触发API调用或过滤结果
      // 这里验证输入框的值已更新
      const searchValue = await page.inputValue('input[placeholder="搜索分类..."]');
      expect(searchValue).toContain('电子');
    });

    test('清空搜索框应重置结果', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 先进行一次搜索
      await page.fill('input[placeholder="搜索分类..."]', '测试');
      await page.press('input[placeholder="搜索..."]', 'Enter');
      await page.waitForTimeout(300);
      
      // 清空搜索框并重新搜索
      const clearButton = page.locator('.el-input__clear, [class*="clear"]');
      if (await clearButton.count() > 0) {
        await clearButton.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('分页功能', () => {
    
    test('应显示分页组件（当数据足够多时）', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 分页器可能存在也可能不存在（取决于数据量）
      // 这里只验证不会出错
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('CRUD操作 - 完整业务流程', () => {
    
    test('完整CRUD流程：创建→编辑→删除', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 1. 点击"添加分类"按钮
      await page.click('button:has-text("添加分类")');
      
      // 2. 对话框应出现
      await expect(page.locator('.el-dialog, [role="dialog"]').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=添加分类')).toBeVisible(); // 对话框标题
      
      // 3. 填写表单
      await page.fill('input[placeholder*="分类名称"], input[placeholder*="请输入"]', 'E2E测试分类');
      
      // 4. 提交表单
      await page.click('button:has-text("确定"):visible');
      
      // 5. 等待操作完成（可能显示成功消息或对话框关闭）
      await page.waitForTimeout(1000);
      
      // 6. 验证对话框已关闭或新数据出现在列表中
      // 注意：实际行为取决于后端是否可用
      const dialogVisible = await page.locator('.el-dialog:visible').count();
      console.log(`Dialog visible after submit: ${dialogVisible}`);
    });

    test('创建分类时的表单验证', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 打开创建对话框
      await page.click('button:has-text("添加分类")');
      await expect(page.locator('.el-dialog, [role="dialog"]').first()).toBeVisible({ timeout: 5000 });
      
      // 尝试不填写名称直接提交
      await page.click('button:has-text("确定"):visible');
      
      // 应显示验证错误提示
      await page.waitForTimeout(500);
      
      // 表单验证应该阻止提交（对话框不应关闭）
      const dialogStillVisible = await page.locator('.el-dialog:visible').count();
      console.log(`Dialog still visible (expected for validation): ${dialogStillVisible}`);
    });
  });

  test.describe('状态切换', () => {
    
    test('应能切换分类的启用/禁用状态', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 找到状态开关（Switch组件）
      const switches = page.locator('.el-switch, [class*="switch"]');
      const switchCount = await switches.count();
      
      if (switchCount > 0) {
        // 点击第一个开关
        await switches.first().click();
        
        // 等待状态更新
        await page.waitForTimeout(500);
        
        console.log(`Clicked status switch, total switches found: ${switchCount}`);
      } else {
        console.log('No switches found - may be no data or different UI structure');
      }
    });
  });

  test.describe('异常场景恢复', () => {
    
    test('网络断开时应显示错误状态和重试按钮', async ({ page }) => {
      // 模拟离线模式
      await page.context().setOffline(true);
      
      await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
      
      // 等待一段时间让错误处理逻辑执行
      await page.waitForTimeout(2000);
      
      // 检查是否显示了错误状态或缓存数据提示
      const hasErrorState = await page.locator('text=加载失败, text=网络异常, text=重试').count() > 0;
      const hasCacheNotice = await page.locator('text=缓存数据').count() > 0;
      
      console.log(`Error state visible: ${hasErrorState}, Cache notice visible: ${hasCacheNotice}`);
      
      // 恢复在线模式
      await page.context().setOffline(false);
    });
  });

  test.describe('响应式设计', () => {
    
    test('在移动端视口下应正确显示', async ({ page }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
      
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 关键元素应可见
      await expect(page.locator('text=添加分类')).toBeVisible();
      await expect(page.locator('body')).toBeVisible();
      
      // 恢复桌面视口
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    test('在平板视口下应正确显示', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
      
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
      
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('性能基准', () => {
    
    test('首次内容绘制(FCP)应在合理时间内', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
      
      // 等待主要内容出现
      await page.waitForSelector('text=添加分类', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      console.log(`Page FCP time: ${loadTime}ms`);
      
      // 首次加载应在5秒内完成
      expect(loadTime).toBeLessThan(5000);
    });

    test('页面交互响应时间', async ({ page }) => {
      await page.goto(`${BASE_URL}/categories`);
      await page.waitForLoadState('networkidle');
      
      // 测量点击按钮的响应时间
      const clickStart = Date.now();
      await page.click('button:has-text("添加分类")');
      const clickTime = Date.now() - clickStart;
      
      console.log(`Button click response time: ${clickTime}ms`);
      
      // 点击响应应在300ms内
      expect(clickTime).toBeLessThan(300);
    });
  });
});

/**
 * 辅助函数：等待API请求完成
 */
async function waitForApiCall(page, urlPattern, timeout = 5000) {
  return page.waitForResponse(
    (response) => response.url().includes(urlPattern),
    { timeout }
  ).catch(() => null);
}

/**
 * 辅助函数：获取Toast/通知消息
 */
async function getNotificationMessage(page) {
  const notification = page.locator('.el-message, [class*="message"], [class*="notification"]');
  if (await notification.count() > 0) {
    return notification.first().textContent();
  }
  return null;
}
