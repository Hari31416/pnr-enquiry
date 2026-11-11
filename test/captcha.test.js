import test from "node:test";
import assert from "node:assert/strict";
import { solveCaptcha } from "../lib/captcha.js";

// Clean templates representation for test image generator
const glyphTemplates = {
  "0": { w: 9, h: 12, key: "001111100011111110011000110110000011110000011110000011110000011110000011110000011011000110011111110001111100" },
  "1": { w: 8, h: 12, key: "011110001111100011011000000110000001100000011000000110000001100000011000000110001111111111111111" },
  "2": { w: 8, h: 12, key: "011111001111111010000111000000110000001100000111000011100001110000111000011100001111111111111111" },
  "3": { w: 9, h: 12, key: "011111110111111111110000011110000011001111110001111110000000111000000011000000011100000111111111110011111100" },
  "4": { w: 10, h: 12, key: "000011110000001111000001101100001110110000110011000111001100011000110011000011001111111111111111111100000011000000001100" },
  "5": { w: 9, h: 12, key: "111111110111111110110000000110000000111111100111111110100000111000000011000000011100000111111111110011111100" },
  "6": { w: 9, h: 12, key: "000111100011111110011000010110000000111111100111111110111000111110000011110000011011000111011111110001111100" },
  "7": { w: 9, h: 12, key: "111111111111111111000000111000000110000000110000001100000001100000011000000011000000110000000110000001110000" },
  "8": { w: 9, h: 12, key: "011111110111111111110000011110000011011111110011111110111000111110000011110000011111000111011111110001111100" },
  "9": { w: 9, h: 12, key: "001111100011111110111000110110000011110000011111000111011111111001111111000000011010000110011111110001111000" },
  "+": { w: 10, h: 10, key: "0000110000000011000000001100000000110000111111111111111111110000110000000011000000001100000000110000" },
  "-": { w: 10, h: 1, key: "1111111111" },
  "=": { w: 10, h: 6, key: "111111111111111111110000000000000000000011111111111111111111" },
  "?": { w: 7, h: 12, key: "011111011111111000011000001100001110001110001110000110000000000001100000110000011000" },
};

function makeImage(text, space = 3, bg = 255, fg = 0) {
  const glyphList = text.split("").map(ch => glyphTemplates[ch]);
  const totalGlyphW = glyphList.reduce((acc, g) => acc + g.w, 0);
  const totalW = totalGlyphW + (glyphList.length + 1) * space;
  const totalH = 30;

  const data = Buffer.alloc(totalW * totalH * 4, bg);
  let curX = space;
  const glyphPositions = [];

  for (const g of glyphList) {
    const startY = Math.floor((totalH - g.h) / 2);
    glyphPositions.push({ x: curX, y: startY, w: g.w, h: g.h });
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.key[y * g.w + x] === "1") {
          const idx = ((startY + y) * totalW + (curX + x)) * 4;
          data[idx] = fg;
          data[idx + 1] = fg;
          data[idx + 2] = fg;
          data[idx + 3] = 255;
        }
      }
    }
    curX += g.w + space;
  }
  return { width: totalW, height: totalH, data, glyphPositions };
}

test("solves clean addition and subtraction equations for all digits 0-9", () => {
  const cases = [
    { expr: "10+20=?", expected: "30" },
    { expr: "45+32=?", expected: "77" },
    { expr: "99+11=?", expected: "110" },
    { expr: "87-34=?", expected: "53" },
    { expr: "60-15=?", expected: "45" },
    { expr: "0+0=?", expected: "0" },
    { expr: "123+456=?", expected: "579" },
    { expr: "789-123=?", expected: "666" },
  ];

  for (const { expr, expected } of cases) {
    const img = makeImage(expr);
    assert.equal(solveCaptcha(img), expected, `Failed on ${expr}`);
  }
});

test("handles negative subtraction results correctly", () => {
  const img = makeImage("12-45=?");
  assert.equal(solveCaptcha(img), "-33");
});

test("solves expressions even if trailing '=? ' is omitted", () => {
  const img = makeImage("42+18");
  assert.equal(solveCaptcha(img), "60");
});

test("tolerates stray noise speckles in image margins", () => {
  const img = makeImage("55+22=?");
  // Inject stray 1-pixel speckles in empty margin areas
  const idx1 = (2 * img.width + 1) * 4;
  img.data[idx1] = 0; img.data[idx1 + 1] = 0; img.data[idx1 + 2] = 0;
  const idx2 = (28 * img.width + 2) * 4;
  img.data[idx2] = 0; img.data[idx2 + 1] = 0; img.data[idx2 + 2] = 0;

  assert.equal(solveCaptcha(img), "77");
});

test("tolerates 1-bit noise flips on character glyphs", () => {
  const img = makeImage("48+31=?");
  // Flip a pixel inside digit '4'
  const p = img.glyphPositions[0];
  const idx = ((p.y + 4) * img.width + (p.x + 4)) * 4;
  img.data[idx] = img.data[idx] === 0 ? 255 : 0;
  img.data[idx + 1] = img.data[idx];
  img.data[idx + 2] = img.data[idx];

  assert.equal(solveCaptcha(img), "79");
});

test("handles adaptive thresholding on non-standard background luminances", () => {
  // Background at 110, foreground at 20
  const img = makeImage("35+25=?", 3, 110, 20);
  assert.equal(solveCaptcha(img), "60");
});

test("returns null gracefully on blank or invalid inputs", () => {
  assert.equal(solveCaptcha({ width: 0, height: 0, data: Buffer.alloc(0) }), null);
  assert.equal(solveCaptcha({ width: 100, height: 30, data: Buffer.alloc(100 * 30 * 4, 255) }), null);
  assert.equal(solveCaptcha({ width: 100, height: 30, data: null }), null);
});
