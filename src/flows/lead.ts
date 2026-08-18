export async function initLeadFlow(options: { email: string; name: string }, _env?: Record<string, unknown>) {
  if (!options.email) {
    throw new Error('EMAIL_REQUIRED');
  }
  return {
    email: options.email,
    name: options.name,
    status: 'CREATED',
  };
}
