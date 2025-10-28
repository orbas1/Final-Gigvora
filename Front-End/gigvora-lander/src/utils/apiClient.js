const defaultHeaders = {
  'Content-Type': 'application/json',
}

export async function apiRequest(path, options = {}) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const error = new Error(errorBody.message || 'Request failed')
      error.status = response.status
      error.body = errorBody
      throw error
    }

    if (response.status === 204) return null
    return response.json()
  } catch (error) {
    const { getMockApiResponse } = await import('./mockApiData')
    const shouldMock = import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'true'
    if (shouldMock) {
      const mock = getMockApiResponse(path, options)
      if (mock !== null && mock !== undefined) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[mock-api]', options.method || 'GET', path, 'served by mock data')
        }
        return mock
      }
    }
    throw error
  }
}

export default apiRequest
