import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

type NaukriCredentials = {
  username: string
  password: string
  profile_id: string | null
}

type NaukriCookies = {
  unid: string
  nkwap: string
  naukAt: string
  naukRt: string
  naukSid: string
}

type RequestBody = {
  action?: 'connect' | 'sync' | 'toggle' | 'disconnect' | 'scheduled'
  username?: string
  password?: string
  profileId?: string
  enabled?: boolean
  consent?: boolean
}

type JobPilotProfile = {
  resume_text?: string | null
  parsed_resume?: Record<string, unknown> | null
  career_profile?: Record<string, unknown> | null
}

const LOGIN_URL = 'https://www.naukri.com/central-login-services/v1/login'
const DASHBOARD_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/dashboard'
const FULL_PROFILE_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v2/users/self?expand_level=4'
const PROFILE_UPDATE_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v1/users/self/fullprofiles'

// Naukri does not publish a supported job-seeker profile-edit API. This mirrors
// Naukri's current browser flow and can change. JobPilot fails closed on
// CAPTCHA/MFA/anti-bot challenges and never attempts to bypass them.
const NAUKRI_NKPARAM =
  'oFYlsMP9SN/18UTJyWR0J4Far8aGlf/RgiTehgjzAfodyCTha++NVMb+jAOJjH4rULRVnn65HS1K0dD3clyVyQ=='

function getServiceRoleKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Supabase secret key is unavailable')

  const parsed = JSON.parse(raw) as Record<string, unknown>
  const key = Object.values(parsed).find((value) => typeof value === 'string')
  if (typeof key !== 'string' || !key) {
    throw new Error('Supabase secret key is unavailable')
  }
  return key
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

function cookieValue(raw: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return raw.match(new RegExp(`${escaped}=([^;,\\n]+)`, 'i'))?.[1] || ''
}

function extractCookies(headers: Headers): NaukriCookies | null {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  const raw = withGetSetCookie.getSetCookie?.().join('\n') || headers.get('set-cookie') || ''

  const cookies: NaukriCookies = {
    unid: cookieValue(raw, 'MYNAUKRI[UNID]'),
    nkwap: cookieValue(raw, 'NKWAP'),
    naukAt: cookieValue(raw, 'nauk_at'),
    naukRt: cookieValue(raw, 'nauk_rt'),
    naukSid: cookieValue(raw, 'nauk_sid')
  }

  return cookies.naukAt && cookies.naukSid ? cookies : null
}

function cookieHeader(cookies: NaukriCookies) {
  return [
    `MYNAUKRI[UNID]=${cookies.unid}`,
    `NKWAP=${cookies.nkwap}`,
    `nauk_at=${cookies.naukAt}`,
    `nauk_rt=${cookies.naukRt}`,
    `nauk_sid=${cookies.naukSid}`
  ].join('; ')
}

const browserHeaders = {
  accept: 'application/json',
  'accept-language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
  appid: '109',
  'cache-control': 'no-cache',
  clientid: 'd3skt0p',
  'content-type': 'application/json',
  gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
  nkparam: NAUKRI_NKPARAM,
  pragma: 'no-cache',
  systemid: 'jobseeker',
  'x-requested-with': 'XMLHttpRequest',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
  referer: 'https://www.naukri.com/'
}

function naukriAuthHeaders(cookies: NaukriCookies, systemid = 'Naukri') {
  return {
    accept: 'application/json',
    appid: '105',
    clientid: 'd3skt0p',
    systemid,
    authorization: `Bearer ${cookies.naukAt}`,
    cookie: cookieHeader(cookies),
    origin: 'https://www.naukri.com',
    referer: 'https://www.naukri.com/mnjuser/profile',
    'x-requested-with': 'XMLHttpRequest',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
  }
}

async function loginNaukri(username: string, password: string) {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: browserHeaders,
    body: JSON.stringify({ username, password }),
    redirect: 'manual'
  })

  const cookies = extractCookies(response.headers)
  if (response.ok && cookies) return cookies

  let message = `Naukri login failed (${response.status}).`
  if ([401, 403, 406, 429].includes(response.status)) {
    message += ' Naukri may require a fresh login, CAPTCHA/MFA, or may have changed its browser validation.'
  }
  throw new Error(message)
}

function findProfileId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProfileId(item)
      if (found) return found
    }
    return null
  }

  const object = value as Record<string, unknown>
  for (const key of ['profileId', 'profile_id', 'profileid']) {
    const candidate = object[key]
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const text = String(candidate).trim()
      if (text) return text
    }
  }

  for (const nested of Object.values(object)) {
    const found = findProfileId(nested)
    if (found) return found
  }

  return null
}

async function discoverProfileId(cookies: NaukriCookies) {
  const response = await fetch(DASHBOARD_URL, {
    headers: naukriAuthHeaders(cookies)
  })

  if (!response.ok) return null
  const payload = await response.json().catch(() => null)
  return findProfileId(payload)
}

async function readNaukriProfile(cookies: NaukriCookies) {
  const response = await fetch(FULL_PROFILE_URL, {
    headers: naukriAuthHeaders(cookies)
  })

  if (!response.ok) {
    throw new Error(`Naukri profile read failed (${response.status}).`)
  }

  return response.json().catch(() => ({}))
}

function findValueByKeys(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object') return undefined

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKeys(item, keys)
      if (found !== undefined) return found
    }
    return undefined
  }

  const object = value as Record<string, unknown>
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) return object[key]
  }

  for (const nested of Object.values(object)) {
    const found = findValueByKeys(nested, keys)
    if (found !== undefined) return found
  }

  return undefined
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const object = item as Record<string, unknown>
          return asString(object.label || object.name || object.skill || object.entitySkill)
        }
        return ''
      })
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  return []
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeSkill(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function uniqueCaseInsensitive(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const value = normalizeSkill(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function limitSkillsToNaukri(values: string[]) {
  const result: string[] = []
  let length = 0
  for (const value of uniqueCaseInsensitive(values)) {
    const added = (result.length ? 1 : 0) + value.length
    if (length + added > 250) break
    result.push(value)
    length += added
  }
  return result
}

function buildDesiredProfile(profile: JobPilotProfile) {
  const parsed = (profile.parsed_resume || {}) as Record<string, unknown>
  const career = (profile.career_profile || {}) as Record<string, unknown>
  const resumeText = (profile.resume_text || '').toLowerCase()

  const parsedSkills = asStringArray(parsed.skills)
  const careerKeywords = asString(career.keywords)
    .split(',')
    .map((item) => item.trim())
    .filter((skill) => skill && resumeText.includes(skill.toLowerCase()))

  const keySkills = limitSkillsToNaukri([...parsedSkills, ...careerKeywords])
  const parsedTitles = asStringArray(parsed.titles)
  const headline = asString(career.headline) || parsedTitles[0] || ''

  return {
    headline: headline.slice(0, 250),
    keySkills
  }
}

async function updateNaukriProfile(
  cookies: NaukriCookies,
  profileId: string,
  profileFields: Record<string, unknown>
) {
  const response = await fetch(PROFILE_UPDATE_URL, {
    method: 'POST',
    headers: {
      ...naukriAuthHeaders(cookies),
      'content-type': 'application/json',
      'x-http-method-override': 'PUT',
      referer: 'https://www.naukri.com/mnjuser/profile?action=modalOpen'
    },
    body: JSON.stringify({ profile: profileFields, profileId })
  })

  if (!response.ok) {
    throw new Error(`Naukri profile update failed (${response.status}).`)
  }
}

async function syncUser(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  await admin.rpc('update_naukri_sync_status', {
    p_user_id: userId,
    p_status: 'pending',
    p_error: null,
    p_profile_id: null,
    p_synced: false
  })

  try {
    const [{ data: credentials, error: credentialsError }, { data: profile, error: profileError }] =
      await Promise.all([
        admin.rpc('get_naukri_sync_credentials', { p_user_id: userId }),
        admin
          .from('profiles')
          .select('resume_text, parsed_resume, career_profile')
          .eq('user_id', userId)
          .single()
      ])

    if (credentialsError) throw credentialsError
    if (profileError) throw profileError

    const credential = (credentials?.[0] || null) as NaukriCredentials | null
    if (!credential?.username || !credential.password) {
      throw new Error('Naukri is not connected.')
    }
    if (!profile?.resume_text) {
      throw new Error('Upload a resume to JobPilot before enabling Naukri Auto Refresh.')
    }

    const cookies = await loginNaukri(credential.username, credential.password)
    const profileId = credential.profile_id || (await discoverProfileId(cookies))
    if (!profileId) {
      throw new Error('JobPilot could not detect your Naukri profile ID. Open Naukri Auto Refresh and add the profile ID once.')
    }

    const desired = buildDesiredProfile(profile as JobPilotProfile)
    if (!desired.headline && desired.keySkills.length === 0) {
      throw new Error('JobPilot does not have enough verified profile data to update Naukri yet.')
    }

    const current = await readNaukriProfile(cookies)
    const currentHeadline = asString(findValueByKeys(current, ['resumeHeadline']))
    const currentSkills = asStringArray(findValueByKeys(current, ['keySkills', 'keyskills']))

    const changedFields: string[] = []
    const update: Record<string, unknown> = {}

    if (desired.headline && normalizeText(desired.headline) !== normalizeText(currentHeadline)) {
      update.resumeHeadline = desired.headline
      changedFields.push('resume headline')
    }

    const currentSkillKey = uniqueCaseInsensitive(currentSkills)
      .map((item) => item.toLowerCase())
      .sort()
      .join('|')
    const desiredSkillKey = uniqueCaseInsensitive(desired.keySkills)
      .map((item) => item.toLowerCase())
      .sort()
      .join('|')

    if (desired.keySkills.length && desiredSkillKey !== currentSkillKey) {
      update.keySkills = desired.keySkills.join(',')
      changedFields.push('key skills')
    }

    if (changedFields.length > 0) {
      await updateNaukriProfile(cookies, profileId, update)
    }

    await admin.rpc('update_naukri_sync_status', {
      p_user_id: userId,
      p_status: 'connected',
      p_error: null,
      p_profile_id: profileId,
      p_synced: changedFields.length > 0
    })

    return {
      userId,
      ok: true,
      changed: changedFields.length > 0,
      changedFields,
      message: changedFields.length
        ? `Updated ${changedFields.join(' and ')}.`
        : 'Naukri profile is already aligned with JobPilot; no artificial change was made.'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const reconnect = /login failed|captcha|mfa|browser validation|not connected/i.test(message)

    await admin.rpc('update_naukri_sync_status', {
      p_user_id: userId,
      p_status: reconnect ? 'needs_reconnect' : 'error',
      p_error: message.slice(0, 1000),
      p_profile_id: null,
      p_synced: false
    })

    return { userId, ok: false, error: message }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is unavailable')

    const admin = createClient(supabaseUrl, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const cronToken = req.headers.get('x-jobpilot-cron')

    if (cronToken) {
      const { data: valid, error } = await admin.rpc('verify_naukri_cron_token', {
        p_token: cronToken
      })
      if (error || valid !== true) return jsonResponse({ error: 'Unauthorized' }, 401)

      const { data: connections, error: connectionError } = await admin
        .from('naukri_connections')
        .select('user_id')
        .eq('enabled', true)
        .in('status', ['pending', 'connected', 'error'])
        .limit(100)

      if (connectionError) throw connectionError
      const userIds = (connections || []).map((row: { user_id: string }) => row.user_id)
      const results = []
      for (const userId of userIds) results.push(await syncUser(admin, userId))

      const successful = results.filter((result) => result.ok).length
      return jsonResponse({
        ok: true,
        attempted: results.length,
        successful,
        failed: results.length - successful,
        results
      })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const action = body.action || 'sync'

    if (action === 'connect') {
      const username = body.username?.trim() || ''
      const password = body.password || ''
      const profileId = body.profileId?.trim() || null

      if (body.consent !== true) {
        return jsonResponse({ error: 'Consent is required for Naukri Auto Refresh.' }, 400)
      }
      if (username.length < 3 || password.length < 4) {
        return jsonResponse({ error: 'Naukri username and password are required.' }, 400)
      }

      const { error } = await admin.rpc('save_naukri_connection_for_user', {
        p_user_id: user.id,
        p_username: username,
        p_password: password,
        p_profile_id: profileId
      })
      if (error) throw error

      const result = await syncUser(admin, user.id)
      return jsonResponse({ ok: true, results: [result] })
    }

    if (action === 'toggle') {
      if (typeof body.enabled !== 'boolean') {
        return jsonResponse({ error: 'enabled must be true or false.' }, 400)
      }

      const { error } = await admin.rpc('set_naukri_auto_refresh_for_user', {
        p_user_id: user.id,
        p_enabled: body.enabled
      })
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    if (action === 'disconnect') {
      const { error } = await admin.rpc('disconnect_naukri_for_user', {
        p_user_id: user.id
      })
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    const result = await syncUser(admin, user.id)
    return jsonResponse({ ok: true, results: [result] })
  } catch (error) {
    console.error('[naukri-sync]', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Naukri sync failed' },
      500
    )
  }
})