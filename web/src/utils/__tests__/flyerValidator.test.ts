import { describe, it, expect } from "vitest";
import {
  FLYER_ACCEPTED_EXTENSIONS,
  FLYER_ACCEPTED_TYPES,
  FLYER_MAX_SIZE_BYTES,
  validateFlyerFile,
} from "../flyerValidator";

function fileOf(size: number, type: string, name = "flyer"): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFlyerFile", () => {
  describe("accepts", () => {
    it.each([
      ["image/jpeg", "flyer.jpg"],
      ["image/png", "flyer.png"],
      ["image/webp", "flyer.webp"],
      ["image/gif", "flyer.gif"],
      ["application/pdf", "flyer.pdf"],
    ])("%s", (type, name) => {
      expect(validateFlyerFile(fileOf(1024, type, name))).toBeNull();
    });

    it("accepts a file exactly at the 10 MB limit", () => {
      expect(validateFlyerFile(fileOf(FLYER_MAX_SIZE_BYTES, "image/png"))).toBeNull();
    });
  });

  describe("rejects", () => {
    it("a file 1 byte over the 10 MB limit", () => {
      expect(validateFlyerFile(fileOf(FLYER_MAX_SIZE_BYTES + 1, "image/png"))).toBe(
        "File too large. Maximum size is 10 MB.",
      );
    });

    it("a text file", () => {
      expect(validateFlyerFile(fileOf(20, "text/plain", "notes.txt"))).toBe(
        "Invalid file type. Please upload a JPG, PNG, WebP, GIF or PDF.",
      );
    });

    it("a file with no reported type", () => {
      expect(validateFlyerFile(fileOf(20, "", "mystery"))).toMatch(/^Invalid file type/);
    });

    it("an unsupported image type such as SVG", () => {
      expect(validateFlyerFile(fileOf(20, "image/svg+xml", "flyer.svg"))).toMatch(/^Invalid file type/);
    });

    it("reports size before type when both are wrong", () => {
      expect(validateFlyerFile(fileOf(FLYER_MAX_SIZE_BYTES + 1, "text/plain"))).toMatch(/^File too large/);
    });
  });
});

describe("flyer validator constants", () => {
  it("accept list covers every accepted MIME type", () => {
    const extensions = FLYER_ACCEPTED_EXTENSIONS.split(",");
    for (const ext of [".jpg", ".png", ".webp", ".gif", ".pdf"]) {
      expect(extensions).toContain(ext);
    }
    expect(FLYER_ACCEPTED_TYPES).toHaveLength(5);
  });
});
