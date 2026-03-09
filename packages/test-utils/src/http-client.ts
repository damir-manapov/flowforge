export interface HttpRequestOptions {
  method?: string | undefined
  headers?: Record<string, string> | undefined
  body?: string | FormData | undefined
  timeout?: number | undefined
}

export interface MultipartField {
  name: string
  value: string | Blob
  filename?: string | undefined
}

export interface HttpResponse {
  status: number
  headers: Headers
  text: string
  json: <T = unknown>() => T
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly defaultHeaders: Record<string, string>

  constructor(baseUrl: string, authToken?: string | undefined) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.defaultHeaders = {}
    if (authToken) {
      this.defaultHeaders.Authorization = `Bearer ${authToken}`
    }
  }

  async request(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const url = `${this.baseUrl}${path}`
    const method = options.method ?? 'GET'

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
    }

    // Don't set Content-Type for FormData — the browser/runtime sets it with the boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type']
    }

    const controller = new AbortController()
    const timeoutMs = options.timeout ?? 30_000
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ?? null,
        signal: controller.signal,
      })

      const text = await response.text()

      return {
        status: response.status,
        headers: response.headers,
        text,
        json: <T = unknown>() => {
          try {
            return JSON.parse(text) as T
          } catch {
            throw new Error(`Failed to parse JSON response (status=${response.status}): ${text.slice(0, 200)}`)
          }
        },
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async get(path: string, headers?: Record<string, string> | undefined): Promise<HttpResponse> {
    return this.request(path, { method: 'GET', ...(headers ? { headers } : {}) })
  }

  async post(path: string, body: unknown, headers?: Record<string, string> | undefined): Promise<HttpResponse> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  async put(path: string, body: unknown, headers?: Record<string, string> | undefined): Promise<HttpResponse> {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  async delete(path: string, headers?: Record<string, string> | undefined): Promise<HttpResponse> {
    return this.request(path, { method: 'DELETE', ...(headers ? { headers } : {}) })
  }

  async patch(path: string, body: unknown, headers?: Record<string, string> | undefined): Promise<HttpResponse> {
    return this.request(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  async postRaw(path: string, body: string, contentType: string): Promise<HttpResponse> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
  }

  async postMultipart(path: string, fields: MultipartField[]): Promise<HttpResponse> {
    const formData = new FormData()
    for (const field of fields) {
      if (field.filename && typeof field.value !== 'string') {
        formData.append(field.name, field.value, field.filename)
      } else {
        formData.append(field.name, field.value)
      }
    }

    return this.request(path, {
      method: 'POST',
      body: formData,
    })
  }

  getRawUrl(path: string): string {
    return `${this.baseUrl}${path}`
  }

  getDefaultHeaders(): Record<string, string> {
    return { ...this.defaultHeaders }
  }

  addDefaultHeaders(headers: Record<string, string>): void {
    Object.assign(this.defaultHeaders, headers)
  }
}
