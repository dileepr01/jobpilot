import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

type Credentials = { username: string; password: string; profile_id: string | null }
type Cookies = { unid: string; nkwap: string; naukAt: string; naukRt: string; naukSid: string }
type Body = { action?: 'connect' | 'sync' | 'toggle' | 'disconnect'; username?: string; password?: string; profileId?: string; enabled?: boolean; consent?: boolean }
type Profile = { parsed_resume?: Record<string, unknown> | null; career_profile?: Record<string, unknown> | null; preferences?: Record<string, unknown> | null }

const LOGIN_URL = 'https://www.naukri.com/central-login-services/v1/login'
const DASHBOARD_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/dashboard'
const FULL_PROFILE_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v2/users/self?expand_level=4'
const PROFILE_UPDATE_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v1/users/self/fullprofiles'
const NKPARAM = 'oFYlsMP9SN/18UTJyWR0J4Far8aGlf/RgiTehgjzAfodyCTha++NVMb+jAOJjH4rULRVnn65HS1K0dD3clyVyQ=='

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Supabase secret key is unavailable')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const key = Object.values(parsed).find((value) => typeof value === 'string')
  if (typeof key !== 'string' || !key) throw new Error('Supabase secret key is unavailable')
  return key
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

function cookieValue(raw: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return raw.match(new RegExp(`${escaped}=([^;,\\n]+)`, 'i'))?.[1] || ''
}

function extractCookies(headers: Headers): Cookies | null {
  const extended = headers as Headers & { getSetCookie?: () => string[] }
  const raw = extended.getSetCookie?.().join('\n') || headers.get('set-cookie') || ''
  const cookies: Cookies = {
    unid: cookieValue(raw, 'MYNAUKRI[UNID]'),
    nkwap: cookieValue(raw, 'NKWAP'),
    naukAt: cookieValue(raw, 'nauk_at'),
    naukRt: cookieValue(raw, 'nauk_rt'),
    naukSid: cookieValue(raw, 'nauk_sid')
  }
  return cookies.naukAt && cookies.naukSid ? cookies : null
}

function cookieHeader(cookies: Cookies) {
  return [`MYNAUKRI[UNID]=${cookies.unid}`, `NKWAP=${cookies.nkwap}`, `nauk_at=${cookies.naukAt}`, `nauk_rt=${cookies.naukRt}`, `nauk_sid=${cookies.naukSid}`].join('; ')
}

const browserHeaders = {
  accept: 'application/json',
  'accept-language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
  appid: '109',
  'cache-control': 'no-cache',
  clientid: 'd3skt0p',
  'content-type': 'application/json',
  gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
  nkparam: NKPARAM,
  pragma: 'no-cache',
  systemid: 'jobseeker',
  'x-requested-with': 'XMLHttpRequest',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
  referer: 'https://www.naukri.com/'
}

function authHeaders(cookies: Cookies, systemid = 'Naukri') {
  return {
    accept: 'application/json', appid: '105', clientid: 'd3skt0p', systemid,
    authorization: `Bearer ${cookies.naukAt}`, cookie: cookieHeader(cookies),
    origin: 'https://www.naukri.com', referer: 'https://www.naukri.com/mnjuser/profile',
    'x-requested-with': 'XMLHttpRequest',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
  }
}

async function login(username: string, password: string) {
  const response = await fetch(LOGIN_URL, { method: 'POST', headers: browserHeaders, body: JSON.stringify({ username, password }), redirect: 'manual' })
  const cookies = extractCookies(response.headers)
  if (response.ok && cookies) return cookies
  let message = `Naukri login failed (${response.status}).`
  if ([401, 403, 406, 429].includes(response.status)) message += ' Naukri may require a fresh login, CAPTCHA/MFA, or may have changed its browser validation.'
  throw new Error(message)
}

function findProfileId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) { const found = findProfileId(item); if (found) return found }
    return null
  }
  const object = value as Record<string, unknown>
  for (const key of ['profileId', 'profile_id', 'profileid']) {
    const candidate = object[key]
    if (typeof candidate === 'string' || typeof candidate === 'number') { const found = String(candidate).trim(); if (found) return found }
  }
  for (const nested of Object.values(object)) { const found = findProfileId(nested); if (found) return found }
  return null
}

async function discoverProfileId(cookies: Cookies) {
  const response = await fetch(DASHBOARD_URL, { headers: authHeaders(cookies) })
  if (!response.ok) return null
  return findProfileId(await response.json().catch(() => null))
}

async function readProfile(cookies: Cookies) {
  const response = await fetch(FULL_PROFILE_URL, { headers: authHeaders(cookies) })
  if (!response.ok) throw new Error(`Naukri profile read failed (${response.status}).`)
  return response.json().catch(() => ({}))
}

function findValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) { const found = findValue(item, keys); if (found !== undefined) return found }
    return undefined
  }
  const object = value as Record<string, unknown>
  for (const key of keys) if (object[key] !== undefined && object[key] !== null) return object[key]
  for (const nested of Object.values(object)) { const found = findValue(nested, keys); if (found !== undefined) return found }
  return undefined
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item.trim() : item && typeof item === 'object' ? text((item as Record<string, unknown>).label || (item as Record<string, unknown>).name || (item as Record<string, unknown>).skill || (item as Record<string, unknown>).entitySkill) : '').filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function unique(values: string[]) {
  const seen = new Set<string>(); const result: string[] = []
  for (const raw of values) { const value = raw.replace(/\s+/g, ' ').trim(); const key = value.toLowerCase(); if (value && !seen.has(key)) { seen.add(key); result.push(value) } }
  return result
}

function limitSkills(values: string[]) {
  const result: string[] = []; let length = 0
  for (const value of unique(values)) { const added = (result.length ? 1 : 0) + value.length; if (length + added > 250) break; result.push(value); length += added }
  return result
}

function desiredProfile(profile: Profile) {
  const parsed = (profile.parsed_resume || {}) as Record<string, unknown>
  const career = (profile.career_profile || {}) as Record<string, unknown>
  const preferences = (profile.preferences || {}) as Record<string, unknown>
  const authoritative = text(career.source) === 'user'
  const explicitSkills = Array.isArray(career.skills) ? strings(career.skills) : []
  const keywordSkills = text(career.keywords).split(',').map((item) => item.trim()).filter(Boolean)
  const keySkills = authoritative ? limitSkills([...explicitSkills, ...keywordSkills]) : []
  const headline = text(career.headline) || text(career.currentTitle) || strings(parsed.titles)[0] || strings(preferences.targetRoles)[0] || ''
  return { headline: headline.slice(0, 250), summary: text(career.summary).slice(0, 3000), keySkills, authoritative }
}

async function updateProfile(cookies: Cookies, profileId: string, fields: Record<string, unknown>) {
  const response = await fetch(PROFILE_UPDATE_URL, {
    method: 'POST',
    headers: { ...authHeaders(cookies), 'content-type': 'application/json', 'x-http-method-override': 'PUT', referer: 'https://www.naukri.com/mnjuser/profile?action=modalOpen' },
    body: JSON.stringify({ profile: fields, profileId })
  })
  if (!response.ok) throw new Error(`Naukri profile update failed (${response.status}).`)
}

async function syncUser(admin: ReturnType<typeof createClient>, userId: string) {
  await admin.rpc('update_naukri_sync_status', { p_user_id: userId, p_status: 'pending', p_error: null, p_profile_id: null, p_synced: false })
  try {
    const [credentialResult, profileResult] = await Promise.all([
      admin.rpc('get_naukri_sync_credentials', { p_user_id: userId }),
      admin.from('profiles').select('parsed_resume, career_profile, preferences').eq('user_id', userId).single()
    ])
    if (credentialResult.error) throw credentialResult.error
    if (profileResult.error) throw profileResult.error
    const credential = (credentialResult.data?.[0] || null) as Credentials | null
    if (!credential?.username || !credential.password) throw new Error('Naukri is not connected.')

    const desired = desiredProfile(profileResult.data as Profile)
    const cookies = await login(credential.username, credential.password)
    const profileId = credential.profile_id || await discoverProfileId(cookies)
    if (!profileId) throw new Error('JobPilot could not detect your Naukri profile ID. Add the profile ID once and reconnect.')

    if (!desired.authoritative) {
      await admin.rpc('update_naukri_sync_status', { p_user_id: userId, p_status: 'connected', p_error: null, p_profile_id: profileId, p_synced: false })
      return {
        userId,
        ok: true,
        changed: false,
        changedFields: [],
        skillChanges: { added: [], removed: [] },
        message: 'Naukri is connected. Save your verified JobPilot Career Profile before any Naukri fields are changed.'
      }
    }

    const current = await readProfile(cookies)
    const currentHeadline = text(findValue(current, ['resumeHeadline']))
    const currentSummary = text(findValue(current, ['profileSummary', 'summary']))
    const currentSkills = unique(strings(findValue(current, ['keySkills', 'keyskills'])))
    const desiredSkills = unique(desired.keySkills)
    const currentKeys = new Set(currentSkills.map((item) => item.toLowerCase()))
    const desiredKeys = new Set(desiredSkills.map((item) => item.toLowerCase()))
    const added = desiredSkills.filter((item) => !currentKeys.has(item.toLowerCase()))
    const removed = currentSkills.filter((item) => !desiredKeys.has(item.toLowerCase()))

    const fields: Record<string, unknown> = {}; const changedFields: string[] = []
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
    if (desired.headline && normalize(desired.headline) !== normalize(currentHeadline)) { fields.resumeHeadline = desired.headline; changedFields.push('resume headline') }
    if (desired.summary && normalize(desired.summary) !== normalize(currentSummary)) { fields.profileSummary = desired.summary; changedFields.push('profile summary') }
    if (added.length || removed.length) { fields.keySkills = desiredSkills.join(','); changedFields.push('key skills') }
    if (changedFields.length) await updateProfile(cookies, profileId, fields)

    await admin.rpc('update_naukri_sync_status', { p_user_id: userId, p_status: 'connected', p_error: null, p_profile_id: profileId, p_synced: changedFields.length > 0 })
    const skillMessage = added.length || removed.length ? ` Skills: ${added.length ? `+${added.join(', ')}` : ''}${added.length && removed.length ? '; ' : ''}${removed.length ? `-${removed.join(', ')}` : ''}.` : ''
    return { userId, ok: true, changed: changedFields.length > 0, changedFields, skillChanges: { added, removed }, message: changedFields.length ? `Updated ${changedFields.join(', ')}.${skillMessage}` : 'Naukri already matches your verified JobPilot Career Profile; no artificial change was made.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const reconnect = /login failed|captcha|mfa|browser validation|not connected/i.test(message)
    await admin.rpc('update_naukri_sync_status', { p_user_id: userId, p_status: reconnect ? 'needs_reconnect' : 'error', p_error: message.slice(0, 1000), p_profile_id: null, p_synced: false })
    return { userId, ok: false, error: message }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL is unavailable')
    const admin = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = (await req.json().catch(() => ({}))) as Body
    const action = body.action || 'sync'
    if (action === 'connect') {
      const username = body.username?.trim() || ''; const password = body.password || ''; const profileId = body.profileId?.trim() || null
      if (body.consent !== true) return json({ error: 'Consent is required for Naukri profile sync.' }, 400)
      if (username.length < 3 || password.length < 4) return json({ error: 'Naukri username and password are required.' }, 400)
      const { error } = await admin.rpc('save_naukri_connection_for_user', { p_user_id: user.id, p_username: username, p_password: password, p_profile_id: profileId })
      if (error) throw error
      return json({ ok: true, results: [await syncUser(admin, user.id)] })
    }
    if (action === 'toggle') {
      if (typeof body.enabled !== 'boolean') return json({ error: 'enabled must be true or false.' }, 400)
      const { error } = await admin.rpc('set_naukri_auto_refresh_for_user', { p_user_id: user.id, p_enabled: body.enabled })
      if (error) throw error
      return json({ ok: true })
    }
    if (action === 'disconnect') {
      const { error } = await admin.rpc('disconnect_naukri_for_user', { p_user_id: user.id })
      if (error) throw error
      return json({ ok: true })
    }
    return json({ ok: true, results: [await syncUser(admin, user.id)] })
  } catch (error) {
    console.error('[naukri-sync]', error)
    return json({ error: error instanceof Error ? error.message : 'Naukri sync failed' }, 500)
  }
})
