/**
 * @vitest-environment jsdom
 */

import { test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import * as YF from '../src/index.js'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

afterEach(() => server.resetHandlers())

test.only('use location.origin as base', async () => {
  const endpoint = vi.fn(() => new Response())
  server.use(http.get('http://localhost:3000/foo', endpoint))

  await YF.get('/foo')

  expect(endpoint).toHaveBeenCalled()
})

test('change base', async () => {
  const endpoint = vi.fn(() => new Response())
  server.use(http.get('http://example.com/foo', endpoint))

  await YF.get('/foo', { base: 'http://example.com' })

  expect(endpoint).toHaveBeenCalled()
})
