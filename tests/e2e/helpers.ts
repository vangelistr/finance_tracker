import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export const OWNER = { name: 'Βαγγέλης', email: 'owner@example.com', password: 'correct-horse-battery' };

export const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 900 },
] as const;

export const SCHEMES = ['light', 'dark'] as const;

export interface A11yIssue {
  screen: string;
  id: string;
  impact: string | null | undefined;
  nodes: number;
  help: string;
}

/** Collected over a run; the spec asserts that no serious or critical WCAG 2.2 AA issue was found. */
export const a11yIssues: A11yIssue[] = [];

/** Screens whose page is wider than the viewport (horizontal scroll), with the widest offending elements. */
export const overflowIssues: Array<{ screen: string; width: number; elements: string[] }> = [];

/** Captures one screen at both widths and both colour schemes, and runs axe-core on each variant. */
export async function captureAll(page: Page, name: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `artifacts/screenshots/${name}-${vp.name}-${scheme}.png`, fullPage: true, animations: 'disabled' });
      if (scheme === 'light') {
        const overflow = await page.evaluate((vw) => {
          const width = document.documentElement.scrollWidth;
          if (width <= vw) return null;
          const elements = [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().right > vw + 1 && !el.parentElement?.closest('.overflow-x-auto'))
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)}`);
          return { width, elements };
        }, vp.width);
        if (overflow) overflowIssues.push({ screen: `${name}-${vp.name}`, ...overflow });
      }
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of result.violations) {
        a11yIssues.push({ screen: `${name}-${vp.name}-${scheme}`, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
      }
    }
  }
}
