import test from 'node:test'
import assert from 'node:assert/strict'
import { drawHistory, passengerChecks } from '../public/charts.js'

class MockNode {
  constructor(tag, namespace = null) {
    this.tag = tag
    this.namespace = namespace
    this.attributes = {}
    this.children = []
    this.textContent = ''
    this.dataset = {}
    this.style = {
      setProperty: (k, v) => {
        this.style[k] = v
      },
    }
  }

  get className() {
    return this.attributes.class ?? ''
  }

  set className(val) {
    this.attributes.class = String(val)
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v)
  }

  getAttribute(k) {
    return this.attributes[k]
  }

  append(...items) {
    for (const item of items) {
      if (typeof item === 'string') {
        this.children.push(item)
      } else {
        this.children.push(item)
      }
    }
  }

  replaceChildren(...items) {
    this.children = [...items]
  }

  addEventListener() {}
  contains() {
    return false
  }
}

globalThis.document = {
  createElement: tag => new MockNode(tag),
  createElementNS: (ns, tag) => new MockNode(tag, ns),
  addEventListener: () => {},
}

test('drawHistory plots confirmed checks at queue 0 with special confirmed badge', () => {
  const container = new MockNode('div')
  const checks = [
    {
      at: 1731470569000,
      data: {
        passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }],
      },
    },
    {
      at: 1731463840000,
      data: {
        passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }],
      },
    },
    {
      at: 1731420767000,
      data: {
        passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }],
      },
    },
    {
      at: 1731380000000,
      data: {
        passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 1' }],
      },
    },
    {
      at: 1731300000000,
      data: {
        passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 7' }],
      },
    },
  ]

  drawHistory(checks, '1', container)

  // container should have SVG graphic, tooltip, and legend
  assert.equal(container.children.length, 3)
  const [svgEl, tooltipEl, legendEl] = container.children
  assert.equal(svgEl.tag, 'svg')

  // Find confirmed badges in the SVG
  const confirmedBadges = svgEl.children.filter(
    node => node.tag === 'g' && node.attributes.class?.includes('chart-confirmed-badge'),
  )
  assert.equal(confirmedBadges.length, 3)

  // Verify the badge contains circle background and checkmark path
  const [firstBadge] = confirmedBadges
  const bg = firstBadge.children.find(c => c.tag === 'circle' && c.attributes.class === 'chart-confirmed-bg')
  const check = firstBadge.children.find(c => c.tag === 'path' && c.attributes.class === 'chart-confirmed-check')
  assert.ok(bg)
  assert.ok(check)

  // Verify y-axis ticks include tick 0
  const textTicks = svgEl.children.filter(c => c.tag === 'text')
  const tickTexts = textTicks.map(t => t.children[0] ?? t.textContent)
  assert.ok(tickTexts.includes(0) || tickTexts.includes('0'))

  // Verify legend has CNF (Confirmed) with confirmed styling
  const confirmedLegend = legendEl.children.find(
    c => c.textContent === 'CNF (Confirmed)' && c.attributes.class === 'chart-legend-confirmed',
  )
  assert.ok(confirmedLegend)
})

test('drawHistory plots a ticket with only confirmed checks', () => {
  const container = new MockNode('div')
  const checks = [
    {
      at: 1731470000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }] },
    },
    {
      at: 1731460000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }] },
    },
  ]

  drawHistory(checks, '1', container)
  assert.equal(container.children.length, 3)
  const [svgEl] = container.children
  assert.equal(svgEl.tag, 'svg')

  const confirmedBadges = svgEl.children.filter(
    node => node.tag === 'g' && node.attributes.class?.includes('chart-confirmed-badge'),
  )
  assert.equal(confirmedBadges.length, 2)
})

test('drawHistory plots waitlist-only checks without confirmed badge and minimum tick 1', () => {
  const container = new MockNode('div')
  const checks = [
    {
      at: 1731470000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 1' }] },
    },
    {
      at: 1731460000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 4' }] },
    },
    {
      at: 1731450000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 7' }] },
    },
  ]

  drawHistory(checks, '1', container)
  const [svgEl] = container.children

  const confirmedBadges = svgEl.children.filter(
    node => node.tag === 'g' && node.attributes.class?.includes('chart-confirmed-badge'),
  )
  assert.equal(confirmedBadges.length, 0)

  const textTicks = svgEl.children.filter(c => c.tag === 'text')
  const tickTexts = textTicks.map(t => t.children[0] ?? t.textContent)
  assert.ok(tickTexts.includes(1) || tickTexts.includes('1'))
  assert.ok(!tickTexts.includes(0) && !tickTexts.includes('0'))
})

test('drawHistory connects waitlist point to confirmed point with CNF stroke', () => {
  const container = new MockNode('div')
  const checks = [
    {
      at: 1731470000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'CNF' }] },
    },
    {
      at: 1731460000000,
      data: { passengerList: [{ passengerSerialNumber: '1', currentStatus: 'RLWL 1' }] },
    },
  ]

  drawHistory(checks, '1', container)
  const [svgEl] = container.children

  // Find line connecting index 0 (RLWL 1) to index 1 (CNF 0)
  const lines = svgEl.children.filter(c => c.tag === 'line' && c.attributes['stroke-width'] === '2.5')
  assert.equal(lines.length, 1)
  assert.equal(lines[0].attributes.stroke, '#175b36')
})
