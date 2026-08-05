import type { Page, TestInfo } from "@playwright/test";

/**
 * Attaches the active route and any relevant fixture context to the test
 * report so a failure points straight at "what URL, what community/proposal
 * id" instead of a bare assertion diff.
 */
export async function attachRouteDiagnostics(
  page: Page,
  testInfo: TestInfo,
  context: Record<string, unknown>,
) {
  await testInfo.attach("route-diagnostics", {
    body: JSON.stringify(
      {
        url: page.url(),
        title: await page.title().catch(() => null),
        ...context,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
}
