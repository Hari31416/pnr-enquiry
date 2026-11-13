import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentStatus,
  isPnr,
  passengerId,
  queuePosition,
  reservationStatus,
  statusGroup,
} from '../public/history.js'

test('queuePosition identifies confirmed status as queue 0', () => {
  const cnfDirect = queuePosition({ currentStatus: 'CNF' })
  assert.deepEqual(cnfDirect, { queue: 'CNF', position: 0 })

  const confirmedWord = queuePosition({ currentStatus: 'CONFIRMED' })
  assert.deepEqual(confirmedWord, { queue: 'CNF', position: 0 })

  const cnfDetails = queuePosition({ currentStatusDetails: 'CNF' })
  assert.deepEqual(cnfDetails, { queue: 'CNF', position: 0 })

  const cnfWithBerth = queuePosition({
    currentStatus: 'CNF',
    currentCoachId: 'B1',
    currentBerthNo: '24',
  })
  assert.deepEqual(cnfWithBerth, { queue: 'CNF', position: 0 })

  const cnfCompound = queuePosition({ currentStatusDetails: 'CNF / B1 / 24 / LB' })
  assert.deepEqual(cnfCompound, { queue: 'CNF', position: 0 })
})

test('queuePosition identifies waitlist and RAC queue positions correctly', () => {
  const rlwl = queuePosition({ currentStatus: 'RLWL 1' })
  assert.deepEqual(rlwl, { queue: 'RLWL', position: 1 })

  const gnwl = queuePosition({ currentStatus: 'GNWL/15' })
  assert.deepEqual(gnwl, { queue: 'GNWL', position: 15 })

  const rac = queuePosition({ currentStatus: 'RAC 4' })
  assert.deepEqual(rac, { queue: 'RAC', position: 4 })

  const indexPosition = queuePosition({
    currentStatus: 'RLWL',
    currentStatusIndex: '7',
  })
  assert.deepEqual(indexPosition, { queue: 'RLWL', position: 7 })
})

test('queuePosition returns null for cancelled or invalid passengers', () => {
  assert.equal(queuePosition({ currentStatus: 'CAN' }), null)
  assert.equal(queuePosition({ currentStatus: 'CANCELLED' }), null)
  assert.equal(queuePosition({ currentStatus: '' }), null)
  assert.equal(queuePosition(null), null)
  assert.equal(queuePosition(undefined), null)
})

test('statusGroup categorizes status correctly', () => {
  assert.equal(statusGroup('CNF'), 'confirmed')
  assert.equal(statusGroup('CONFIRMED'), 'confirmed')
  assert.equal(statusGroup('CNF / S1 / 20'), 'confirmed')
  assert.equal(statusGroup('RAC 2'), 'rac')
  assert.equal(statusGroup('RLWL 10'), 'waitlist')
  assert.equal(statusGroup('CAN'), 'cancelled')
  assert.equal(statusGroup('UNKNOWN'), 'other')
})

test('isPnr validates 10-digit numbers', () => {
  assert.equal(isPnr('1234567890'), true)
  assert.equal(isPnr('123456789'), false)
  assert.equal(isPnr('12345678901'), false)
  assert.equal(isPnr('abcdefghij'), false)
})
