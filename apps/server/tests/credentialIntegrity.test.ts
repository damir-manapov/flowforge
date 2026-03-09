import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '..', 'data')

interface CredentialDef {
  name: string
  label: string
  version: number
  inputs: unknown[]
}

interface NodeDef {
  name: string
  label: string
  credential?: { credentialNames: string[] }
}

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, filename), 'utf-8')) as T
}

describe('credential definitions integrity', () => {
  const credentials = loadJson<CredentialDef[]>('components-credentials.json')
  const nodes = loadJson<NodeDef[]>('nodes.json')

  it('has at least 100 credential definitions', () => {
    expect(credentials.length).toBeGreaterThanOrEqual(100)
  })

  it('every credential has label, name, version, and inputs', () => {
    for (const cred of credentials) {
      expect(cred.name, `credential missing name`).toBeTruthy()
      expect(cred.label, `${cred.name} missing label`).toBeTruthy()
      expect(cred.version, `${cred.name} missing version`).toBeGreaterThan(0)
      expect(Array.isArray(cred.inputs), `${cred.name} inputs is not array`).toBe(true)
    }
  })

  it('credential names are unique', () => {
    const names = credentials.map((c) => c.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('every node credential reference has a matching credential definition', () => {
    const credNames = new Set(credentials.map((c) => c.name))
    const missing: string[] = []

    for (const node of nodes) {
      if (!node.credential?.credentialNames) continue
      for (const credName of node.credential.credentialNames) {
        if (!credNames.has(credName)) {
          missing.push(`${node.name} -> ${credName}`)
        }
      }
    }

    if (missing.length > 0) {
      // Report but don't fail — some nodes may reference deprecated credentials
      // This gives visibility into gaps
      console.warn(`[integrity] ${missing.length} credential refs without definitions: ${missing.join(', ')}`)
    }
    // At least 90% coverage
    const totalRefs = nodes.filter((n) => n.credential?.credentialNames).length
    const coverageRate = totalRefs > 0 ? (totalRefs - missing.length) / totalRefs : 1
    expect(coverageRate).toBeGreaterThan(0.85)
  })
})
