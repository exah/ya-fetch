/**
 * @vitest-environment jsdom
 */

import { afterEach, test } from 'vitest'
import nock from 'nock'
import * as YF from '../src/index.js'

afterEach(() => nock.cleanAll())

test('use location.origin as base', async () => {
  const scope = nock('http://localhost:3000').get('/foo').reply(200)
  await YF.get('/foo')

  scope.done()
})

test('change base', async () => {
  const scope = nock('http://example.com').get('/foo').reply(200)
  await YF.get('/foo', { base: 'http://example.com' })

  scope.done()
})
