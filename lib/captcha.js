/*
Digit templates adapted from https://github.com/x64vbhv/ntes-client/blob/main/ntes/pnr.py
MIT License
Copyright (c) 2026 Vaibhav Chandra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const glyphs = {
  // Alternate 3 observed in the live railway image.
  "011111100111111111100000011000000011001111110001111110000000111000000011000000011100000111111111110011111100": "3",
  "111111111111111111000000111000000110000000110000001100000001100000011000000011000000110000000110000001110000": "7",
  "0000110000000011000000001100000000110000111111111111111111110000110000000011000000001100000000110000": "+",
  "011111001111111010000111000000110000001100000111000011100001110000111000011100001111111111111111": "2",
  "001111100011111110011000110110000011110000011110000011110000011110000011110000011011000110011111110001111100": "0",
  "111111111111111111110000000000000000000011111111111111111111": "=",
  "011111011111111000011000001100001110001110001110000110000000000001100000110000011000": "?",
  "000111100011111110011000010110000000111111100111111110111000111110000011110000011011000111011111110001111100": "6",
  "011111110111111111110000011110000011011111110011111110111000111110000011110000011111000111011111110001111100": "8",
  "1111111111": "-",
  "011111110111111111110000011110000011001111110001111110000000111000000011000000011100000111111111110011111100": "3",
  "011110001111100011011000000110000001100000011000000110000001100000011000000110001111111111111111": "1",
  "000011110000001111000001101100001110110000110011000111001100011000110011000011001111111111111111111100000011000000001100": "4",
  // Standard 9 observed in uncompressed and anti-aliased renderings.
  "001111100011111110111000110110000011110000011111000111011111111001111111000000011010000110011111110001111000": "9",
  "00111110001111111011100001101100000111100000111110001110111111110011111110000000110100001100111111100011111000": "9",
  "111111110111111110110000000110000000111111100111111110100000111000000011000000011100000111111111110011111100": "5",
};

const templates = Object.entries(glyphs).map(([key, char]) => {
  let w = 0, h = 0;
  if (char === "-") { w = 10; h = 1; }
  else if (char === "+") { w = 10; h = 10; }
  else if (char === "=") { w = 10; h = 6; }
  else if (char === "?") { w = 7; h = 12; }
  else if (char === "4") { w = 10; h = 12; }
  else if (char === "1" || char === "2") { w = 8; h = 12; }
  else if (char === "9" && key.length === 110) { w = 10; h = 11; }
  else if (key.length === 108) { w = 9; h = 12; }
  return { char, key, w, h };
});

function dist2D(cKey, cW, cH, tKey, tW, tH) {
  if (Math.abs(cW - tW) > 1 || Math.abs(cH - tH) > 1) return Infinity;
  let minDiff = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let diff = 0;
      const minX = Math.min(0, dx);
      const maxX = Math.max(cW, tW + dx);
      const minY = Math.min(0, dy);
      const maxY = Math.max(cH, tH + dy);

      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          const cPixel = (x >= 0 && x < cW && y >= 0 && y < cH) ? cKey[y * cW + x] === "1" : false;
          const tx = x - dx;
          const ty = y - dy;
          const tPixel = (tx >= 0 && tx < tW && ty >= 0 && ty < tH) ? tKey[ty * tW + tx] === "1" : false;
          if (cPixel !== tPixel) diff++;
        }
      }
      if (diff < minDiff) minDiff = diff;
    }
  }
  return minDiff;
}

function matchGlyph(key, w, h) {
  // 1. Exact match fast path (O(1))
  const exact = glyphs[key];
  if (exact) return exact;

  // 2. Same-length Hamming distance comparison
  let bestChar = null, bestDist = Infinity, secondDist = Infinity;
  for (const t of templates) {
    if (t.key.length === key.length) {
      let diff = 0;
      for (let i = 0; i < key.length; i++) {
        if (key[i] !== t.key[i]) diff++;
      }
      if (diff < bestDist) {
        if (bestChar !== t.char) secondDist = bestDist;
        bestDist = diff;
        bestChar = t.char;
      } else if (diff < secondDist && t.char !== bestChar) {
        secondDist = diff;
      }
    }
  }
  if (bestDist <= 5 && (secondDist - bestDist >= 3 || bestDist <= 2)) {
    return bestChar;
  }

  // 3. 2D spatial template matching with +/- 1 shift tolerance
  bestChar = null; bestDist = Infinity; secondDist = Infinity;
  for (const t of templates) {
    const d = dist2D(key, w, h, t.key, t.w, t.h);
    if (d < bestDist) {
      if (bestChar !== t.char) secondDist = bestDist;
      bestDist = d;
      bestChar = t.char;
    } else if (d < secondDist && t.char !== bestChar) {
      secondDist = d;
    }
  }
  if (bestDist <= 6 && (secondDist - bestDist >= 3 || bestDist <= 2)) {
    return bestChar;
  }

  return null;
}

function solvePass({ width, height, data }, threshold = 128) {
  const ink = (x, y) => {
    const index = (y * width + x) * 4;
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const alpha = data[index + 3] / 255;
    return +(gray * alpha + 255 * (1 - alpha) < threshold);
  };

  const occupied = Array.from({ length: width }, (_, x) =>
    Array.from({ length: height }, (_, y) => ink(x, y)).some(Boolean));

  let expression = "";

  for (let start = occupied.indexOf(true); start !== -1;) {
    let end = occupied.indexOf(false, start);
    if (end === -1) end = width;
    const segWidth = end - start;

    const rows = Array.from({ length: height }, (_, y) =>
      Array.from({ length: segWidth }, (_, x) => ink(start + x, y)).join(""));

    const totalInk = rows.reduce((acc, r) => acc + (r.match(/1/g) || []).length, 0);

    // Skip isolated noise speckles (fewer than 5 ink pixels)
    if (totalInk < 5) {
      start = occupied.indexOf(true, end);
      continue;
    }

    const first = rows.findIndex(row => row.includes("1"));
    const last = rows.findLastIndex(row => row.includes("1"));
    if (first === -1 || last === -1) {
      start = occupied.indexOf(true, end);
      continue;
    }

    const segHeight = last - first + 1;
    const key = rows.slice(first, last + 1).join("");
    let glyph = matchGlyph(key, segWidth, segHeight);

    // If matching failed, try trimming outer columns that have <= 1 ink pixel (adjacent noise)
    if (!glyph && segWidth > 7) {
      let left = 0;
      while (left < segWidth - 7) {
        let colInk = 0;
        for (let y = 0; y < rows.length; y++) if (rows[y][left] === "1") colInk++;
        if (colInk <= 1) left++;
        else break;
      }
      let right = segWidth;
      while (right > left + 7) {
        let colInk = 0;
        for (let y = 0; y < rows.length; y++) if (rows[y][right - 1] === "1") colInk++;
        if (colInk <= 1) right--;
        else break;
      }
      if (left > 0 || right < segWidth) {
        const trimmedRows = rows.map(r => r.slice(left, right));
        const tf = trimmedRows.findIndex(r => r.includes("1"));
        const tl = trimmedRows.findLastIndex(r => r.includes("1"));
        if (tf !== -1) {
          const tKey = trimmedRows.slice(tf, tl + 1).join("");
          glyph = matchGlyph(tKey, right - left, tl - tf + 1);
        }
      }
    }

    // Split touching characters when an abnormally wide segment fails lookup
    if (!glyph && segWidth >= 15) {
      let minCol = -1, minColInk = Infinity;
      for (let x = 6; x < segWidth - 6; x++) {
        let colInk = 0;
        for (let y = first; y <= last; y++) {
          if (rows[y][x] === "1") colInk++;
        }
        if (colInk < minColInk) {
          minColInk = colInk;
          minCol = x;
        }
      }
      if (minCol !== -1 && minColInk <= 3) {
        const leftWidth = minCol;
        const leftRows = Array.from({ length: height }, (_, y) =>
          Array.from({ length: leftWidth }, (_, x) => ink(start + x, y)).join(""));
        const leftFirst = leftRows.findIndex(r => r.includes("1"));
        const leftLast = leftRows.findLastIndex(r => r.includes("1"));
        if (leftFirst !== -1) {
          const leftKey = leftRows.slice(leftFirst, leftLast + 1).join("");
          const leftGlyph = matchGlyph(leftKey, leftWidth, leftLast - leftFirst + 1);
          if (leftGlyph) {
            expression += leftGlyph;
            start = start + minCol;
            continue;
          }
        }
      }
    }

    if (glyph) {
      expression += glyph;
    } else {
      // If we already have a complete math expression, ignore trailing noise / artifacts
      if (/^(\d{1,3})([+-])(\d{1,3})/.test(expression)) {
        break;
      }
      return null;
    }

    start = occupied.indexOf(true, end);
  }

  const match = /^(\d{1,3})([+-])(\d{1,3})(?:=\?)?$/.exec(expression);
  if (!match) {
    const partialMatch = /^(\d{1,3})([+-])(\d{1,3})/.exec(expression);
    if (!partialMatch) return null;
    const [, left, operator, right] = partialMatch;
    return String(Number(left) + (operator === "+" ? 1 : -1) * Number(right));
  }
  const [, left, operator, right] = match;
  return String(Number(left) + (operator === "+" ? 1 : -1) * Number(right));
}

export function solveCaptcha({ width, height, data }) {
  if (!data || width <= 0 || height <= 0) return null;

  // Pass 1: standard threshold (128) maintaining 100% fidelity with original
  const res = solvePass({ width, height, data }, 128);
  if (res !== null) return res;

  // Pass 2: fallback adaptive threshold based on foreground/background percentiles
  const lums = [];
  const step = Math.max(1, Math.floor((width * height) / 500));
  for (let i = 0; i < width * height; i += step) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    const alpha = data[idx + 3] / 255;
    lums.push(gray * alpha + 255 * (1 - alpha));
  }
  lums.sort((a, b) => a - b);
  const darkAvg = lums.slice(0, Math.floor(lums.length * 0.15)).reduce((a, b) => a + b, 0) / (lums.length * 0.15);
  const brightAvg = lums.slice(Math.floor(lums.length * 0.85)).reduce((a, b) => a + b, 0) / (lums.length * 0.15);
  const adaptiveThreshold = Math.round((darkAvg + brightAvg) / 2);

  if (Math.abs(adaptiveThreshold - 128) > 10 && adaptiveThreshold > 50 && adaptiveThreshold < 200) {
    return solvePass({ width, height, data }, adaptiveThreshold);
  }

  return null;
}
