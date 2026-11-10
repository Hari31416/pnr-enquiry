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
  "00111110001111111011100001101100000111100000111110001110111111110011111110000000110100001100111111100011111000": "9",
  "111111110111111110110000000110000000111111100111111110100000111000000011000000011100000111111111110011111100": "5",
};

export function solveCaptcha({ width, height, data }) {
  const ink = (x, y) => {
    const index = (y * width + x) * 4;
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const alpha = data[index + 3] / 255;
    return +(gray * alpha + 255 * (1 - alpha) < 128);
  };
  const occupied = Array.from({ length: width }, (_, x) =>
    Array.from({ length: height }, (_, y) => ink(x, y)).some(Boolean));
  let expression = "";
  for (let start = occupied.indexOf(true); start !== -1;) {
    let end = occupied.indexOf(false, start);
    if (end === -1) end = width;
    const rows = Array.from({ length: height }, (_, y) =>
      Array.from({ length: end - start }, (_, x) => ink(start + x, y)).join(""));
    const first = rows.findIndex(row => row.includes("1"));
    const last = rows.findLastIndex(row => row.includes("1"));
    const glyph = glyphs[rows.slice(first, last + 1).join("")];
    if (!glyph) return null;
    expression += glyph;
    start = occupied.indexOf(true, end);
  }
  const match = /^(\d{1,3})([+-])(\d{1,3})(?:=\?)?$/.exec(expression);
  if (!match) return null;
  const [, left, operator, right] = match;
  return String(Number(left) + (operator === "+" ? 1 : -1) * Number(right));
}
