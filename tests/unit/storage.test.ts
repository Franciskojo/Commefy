import { describe, it, expect } from "vitest";
import { validateImageMagicBytes } from "@/lib/storage/service";

describe("File Upload Magic Byte Sniffing", () => {
  it("detects valid PNG signatures", () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const res = validateImageMagicBytes(pngHeader);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/png");
  });

  it("detects valid JPEG signatures", () => {
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const res = validateImageMagicBytes(jpegHeader);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/jpeg");
  });

  it("detects valid GIF signatures", () => {
    const gifHeader = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "binary");
    const res = validateImageMagicBytes(gifHeader);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/gif");
  });

  it("detects valid WebP signatures", () => {
    const webpHeader = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "binary");
    const res = validateImageMagicBytes(webpHeader);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/webp");
  });

  it("rejects malicious executables disguised as images", () => {
    // Windows PE EXE (MZ header)
    const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", "binary");
    expect(validateImageMagicBytes(exe).valid).toBe(false);

    // Shell script disguised as png
    const sh = Buffer.from("#!/bin/bash\necho bad\n", "utf8");
    expect(validateImageMagicBytes(sh).valid).toBe(false);
  });
});
