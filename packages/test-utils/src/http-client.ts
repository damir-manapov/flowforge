export interface HttpRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer | FormData
  timeout?: number
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
      this.defaultHeaders['Authorization'] = `Bearer ${authToken}`
    }
  }

  async request(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const url = `${this.baseUrl}${path}`
    const method = options.method ?? 'GET'

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
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
        json: <T = unknown>() => JSON.parse(text) as T,
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async get(path: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(path, { method: 'GET', headers })
  }

  async post(path: string, body: unknown, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  async put(path: string, body: unknown, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  async delete(path: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(path, { method: 'DELETE', headers })
  }

  async postRaw(path: string, body: string | Buffer, contentType: string): Promise<HttpResponse> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
  }

  async postMultipart(path: string, fields: MultipartField[]): Promise<HttpResponse> {
    const formData = new FormData()
    for (const field of fields) {
      if (field.filename) {
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
}
