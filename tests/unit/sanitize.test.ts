import { describe, it, expect } from "vitest";
import {
  slugify,
  safeHexColor,
  escapeRegex,
  escapeHtml,
  safeRedirectPath,
  RESERVED_SLUGS,
} from "@/lib/security/sanitize";

describe("Sanitization and validation helpers", () => {
  it("slugifies text into URL-safe lowercase slugs", () => {
    expect(slugify("My Cool Store #1!")).toBe("my-cool-store-1");
    expect(slugify("  Café & Deli  ")).toBe("cafe-deli");
    expect(slugify("---test---")).toBe("test");
  });

  it("validates strict hex color codes and falls back safely", () => {
    expect(safeHexColor("#4F46E5", "#000000")).toBe("#4f46e5");
    expect(safeHexColor("#fff", "#000000")).toBe("#000000"); // 3 digits rejected
    expect(safeHexColor("red", "#000000")).toBe("#000000"); // named color rejected
    expect(safeHexColor("javascript:alert(1)", "#000000")).toBe("#000000"); // XSS injection rejected
    expect(safeHexColor("url(evil.com)", "#000000")).toBe("#000000");
  });

  it("escapes regex special characters", () => {
    const input = "test.*+?^${}()|[]\\";
    const escaped = escapeRegex(input);
    const regex = new RegExp(escaped);
    expect(regex.test(input)).toBe(true);
    expect(regex.test("testXXXX")).toBe(false);
  });

  it("escapes HTML to prevent injection in email templates", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
    expect(escapeHtml('Hello & "World"')).toBe("Hello &amp; &quot;World&quot;");
  });

  it("guards against open redirects by strictly allowing relative paths only", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/store/orders?page=2#tab")).toBe("/store/orders?page=2#tab");

    // Rejected open redirects:
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });

  it("contains platform reserved slugs", () => {
    expect(RESERVED_SLUGS.has("api")).toBe(true);
    expect(RESERVED_SLUGS.has("admin")).toBe(true);
    expect(RESERVED_SLUGS.has("platform")).toBe(true);
    expect(RESERVED_SLUGS.has("login")).toBe(true);
  });
});
