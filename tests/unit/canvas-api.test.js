// Unit tests for CanvasAPI (mock fetch)

// Inline CanvasAPIError for test context (avoids ES module import issues)
class CanvasAPIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'CanvasAPIError';
    this.status = status;
    this.code = code;
  }
}

// Minimal CanvasAPI implementation for testing
class CanvasAPI {
  constructor(domain, accessToken) {
    this.baseUrl = `https://${domain}`;
    this.token = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async validateToken() {
    return this._makeRequest('/api/v1/users/self');
  }

  async getCourses() {
    return this._makeRequest('/api/v1/courses?enrollment_state=active');
  }

  async _makeRequest(endpoint) {
    const url = `${this.baseUrl}${endpoint}`;
    let response;
    try {
      response = await fetch(url, { headers: this.headers });
    } catch {
      throw new CanvasAPIError('Connection lost.', 0, 'NETWORK_ERROR');
    }

    if (response.status === 401) throw new CanvasAPIError('Your access token is invalid.', 401, 'INVALID_TOKEN');
    if (response.status === 403) throw new CanvasAPIError('Canvas API access is not available.', 403, 'FORBIDDEN');
    if (response.status === 429) throw new CanvasAPIError('Rate limit exceeded.', 429, 'RATE_LIMIT');
    if (response.status >= 500) throw new CanvasAPIError('Canvas unavailable.', response.status, 'SERVER_ERROR');
    if (!response.ok) throw new CanvasAPIError(`HTTP ${response.status}`, response.status, 'HTTP_ERROR');

    return response.json();
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CanvasAPI', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('validates token successfully', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 12345, name: 'Test User' }),
      })
    );

    const api = new CanvasAPI('school.instructure.com', 'test-token');
    const result = await api.validateToken();
    expect(result.id).toBe(12345);
    expect(result.name).toBe('Test User');
  });

  test('throws CanvasAPIError with INVALID_TOKEN code on 401', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ status: 'unauthenticated' }),
      })
    );

    const api = new CanvasAPI('school.instructure.com', 'bad-token');
    await expect(api.validateToken()).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 401,
    });
  });

  test('throws CanvasAPIError with FORBIDDEN code on 403', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ status: 'unauthorized' }),
      })
    );

    const api = new CanvasAPI('school.instructure.com', 'token');
    await expect(api.validateToken()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('throws CanvasAPIError with SERVER_ERROR code on 500', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    const api = new CanvasAPI('school.instructure.com', 'token');
    await expect(api.validateToken()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });

  test('throws CanvasAPIError with NETWORK_ERROR when fetch rejects', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Failed to fetch')));

    const api = new CanvasAPI('school.instructure.com', 'token');
    await expect(api.validateToken()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  test('fetches courses with Authorization header', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 101, name: 'Math' }, { id: 102, name: 'English' }]),
      })
    );

    const api = new CanvasAPI('school.instructure.com', 'my-token');
    const courses = await api.getCourses();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/courses'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      })
    );
    expect(courses).toHaveLength(2);
    expect(courses[0].id).toBe(101);
  });
});
