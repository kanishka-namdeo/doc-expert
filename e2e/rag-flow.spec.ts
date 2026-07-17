import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('RAG Flow', () => {
  test.setTimeout(120000); // 2 minutes for LLM responses
  test.beforeEach(async ({ page, context }) => {
    // Clear storage to ensure fresh login
    await context.clearCookies();
    
    // Navigate to login first
    await page.goto('/login');
    
    // Now clear localStorage after page has loaded
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Wait for login form to be visible
    await page.waitForSelector('form', { timeout: 5000 });
    
    // Login with test account
    await page.locator('label[for="email"]').locator('..').locator('input').fill('editor@docexpert.test');
    await page.locator('label[for="password"]').locator('..').locator('input').fill('Editor123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for redirect to home (or already be there)
    await page.waitForURL('**', { timeout: 15000 });
    // Ensure we're on the home page
    if (!page.url().endsWith('/')) {
      await page.goto('/');
    }
  });

  test('complete RAG flow: upload, chat, verify citations', async ({ page }) => {
    // Step 1: Verify we're on the chat page
    await expect(page.getByRole('heading', { name: 'Doc Expert' })).toBeVisible();
    
    // Step 2: Upload a document
    const testFilePath = path.join(process.cwd(), 'test-doc.md');
    
    // Click Upload button to open dialog
    await page.getByRole('button', { name: /Upload/i }).click();
    
    // Wait for dialog to be visible
    await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 5000 });
    
    // Find the file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload to complete - look for success toast with chunk count
    // Sonner toasts render in a portal, so we need to wait for the toast element
    await page.waitForSelector('[data-sonner-toast]:has-text("Document ingested")', { timeout: 60000 });
    
    // Step 3: Send a chat message that matches document content
    const chatInput = page.getByPlaceholder('Ask a question...');
    await chatInput.fill('What embedding model does Doc Expert use?');
    await chatInput.press('Enter');
    
    // Wait for response to appear
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });
    
    // Wait for streaming to complete (button text returns to "Send")
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && btn.textContent === 'Send';
    }, { timeout: 60000 });
    
    // Step 4: Verify sources appear in the response
    // Sources are rendered as links from source-document parts
    const sourceLinks = page.locator('text=Source:');
    await expect(sourceLinks.first()).toBeVisible({ timeout: 5000 });
    
    // Also check for LLM-generated citation badges if present
    const citationBadges = page.locator('sup.citation-badge');
    const citationCount = await citationBadges.count();
    if (citationCount > 0) {
      const title = await citationBadges.first().getAttribute('title');
      expect(title).toBeTruthy();
    }
  });

  test('document upload shows progress and completion', async ({ page }) => {
    const testFilePath = path.join(process.cwd(), 'test-doc.md');
    
    // Click Upload button to open dialog
    await page.getByRole('button', { name: /Upload/i }).click();
    
    // Wait for dialog to be visible
    await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 5000 });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should show processing state
    await expect(page.getByText('Processing document...')).toBeVisible();
    
    // Wait for completion
    await page.waitForSelector('text=Document ingested', { timeout: 60000 });
  });

  test('chat with streaming response', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(`Page error: ${err.message}`);
    });
    
    // Send a message
    const chatInput = page.getByPlaceholder('Ask a question...');
    await chatInput.fill('Hello, can you help me?');
    await chatInput.press('Enter');
    
    // Wait for either success or error
    try {
      await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });
    } catch (e) {
      // Check if there's an error message displayed
      const errorText = await page.locator('text=Chat processing failed').textContent().catch(() => null);
      if (errorText) {
        console.log('Chat API error detected');
        console.log('Console errors:', errors);
        throw new Error(`Chat failed with error: ${errorText}. Console errors: ${errors.join(', ')}`);
      }
      throw e;
    }
    
    // Wait for streaming to complete (button text returns to "Send")
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && btn.textContent === 'Send';
    }, { timeout: 60000 });
    
    // Verify response is complete (use last() since there may be previous messages)
    const assistantMessage = page.locator('[data-testid="assistant-message"]').last();
    await expect(assistantMessage).not.toBeEmpty();
  });
});