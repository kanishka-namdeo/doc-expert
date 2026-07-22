import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('RAG Flow', () => {
  test.setTimeout(120000); // 2 minutes for LLM responses

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
    await page.waitForSelector('form', { timeout: 5000 });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    const emailInput = page.getByLabel('Email');
    await emailInput.fill('editor@docexpert.test');
    await emailInput.blur();
    await page.waitForSelector('label[for="password"]', { timeout: 10000 });
    await page.getByLabel('Password').fill('Editor123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
  });

  test('complete RAG flow: upload, chat, verify citations', async ({ page }) => {
    // Step 1: Verify we're on the chat page
    await expect(page.getByRole('heading', { name: 'Doc Expert', exact: true })).toBeVisible();
    
    // Step 2: Upload a document
    const testFilePath = path.join(process.cwd(), 'test-doc.md');
    
    // Click Upload button to open dialog
    await page.getByRole('button', { name: 'Upload document' }).click();
    
    // Wait for dialog to be visible
    await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 5000 });
    
    // Use the file input and trigger the dropzone properly
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    // Trigger change event for react-dropzone
    await fileInput.dispatchEvent('change');
    
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
    await page.getByRole('button', { name: 'Upload document' }).click();
    
    // Wait for dialog to be visible
    await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 5000 });
    
    // Trigger the file input and wait for the dropzone to handle it
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for processing state to appear (indicates onDrop was triggered)
    await expect(page.getByText('Processing document...')).toBeVisible({ timeout: 10000 });
    
    // Wait for completion toast
    await page.waitForSelector('[data-sonner-toast]:has-text("Document ingested")', { timeout: 60000 });
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