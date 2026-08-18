import { describe, it, expect } from 'vitest'
import { createMockEnv } from '../mocks/env'
import { initLeadFlow } from '@/flows/lead'

describe('Lead flow MOC', () => {
  it('deve criar lead com status CREATED', async () => {
    const env = createMockEnv()
    const result = await initLeadFlow({ email: 'test@example.com', name: 'Test' }, env)
    expect(result.status).toBe('CREATED')
    expect(result.email).toBe('test@example.com')
    expect(result.name).toBe('Test')
  })

  it('deve rejeitar email vazio', async () => {
    const env = createMockEnv()
    await expect(initLeadFlow({ email: '', name: 'Test' }, env)).rejects.toThrow('EMAIL_REQUIRED')
  })
});
