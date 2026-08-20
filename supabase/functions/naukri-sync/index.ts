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

const LOGIN_URL = 'https://www.naukri.com/central-login-services/v1/login'
const PROFILE_LIST_URL = 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/profiles'
const FILE_UPLOAD_URL = 'https://filevalidation.naukri.com/file'

// Naukri does not publish a job-seeker profile editing API. This token/header
// combination mirrors Naukri's browser flow and may change. We fail closed if
// Naukri presents an anti-bot/MFA challenge; JobPilot never attempts to bypass it.
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
  const response = await fetch(PROFILE_LIST_URL, {
    headers: {
      accept: 'application/json',
      appid: '109',
      clientid: 'd3skt0p',
      systemid: 'jobseeker',
      authorization: `Bearer ${cookies.naukAt}`,
      cookie: cookieHeader(cookies),
      referer: 'https://www.naukri.com/'
    }
  })

  if (!response.ok) return null
  const payload = await response.json().catch(() => null)
  return findProfileId(payload)
}

function resumeMime(filename: string) {
  return filename.toLowerCase().endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf'
}

async function uploadResumeToNaukri(
  cookies: NaukriCookies,
  resume: Blob,
  filename: string,
  profileId: string
) {
  const formKey = 'F51f8e7e54e205'
  const fileKey = 'UyFNbCXtBHdkXQ'
  const form = new FormData()
  form.append('formKey', formKey)
  form.append('fileName', filename)
  form.append('uploadCallback', 'true')
  form.append('fileKey', fileKey)
  form.append('file', new Blob([resume], { type: resumeMime(filename) }), filename)

  const cookiesString = cookieHeader(cookies)
  const uploadResponse = await fetch(FILE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      appid: '109',
      clientid: 'd3skt0p',
      systemid: 'fileupload',
      origin: 'https://www.naukri.com',
      referer: 'https://www.naukri.com/',
      cookie: cookiesString,
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
    },
    body: form
  })

  if (!uploadResponse.ok) {
    throw new Error(`Naukri resume upload failed (${uploadResponse.status}).`)
  }

  const updateUrl = `https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/profiles/${encodeURIComponent(profileId)}/advResume`
  const updateResponse = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      appid: '105',
      systemid: '105',
      clientid: 'd3skt0p',
      authorization: `Bearer ${cookies.naukAt}`,
      cookie: cookiesString,
      'content-type': 'application/json',
      'x-http-method-override': 'PUT',
      'x-requested-with': 'XMLHttpRequest',
      origin: 'https://www.naukri.com',
      referer: 'https://www.naukri.com/'
    },
    body: JSON.stringify({
      textCV: {
        formKey,
        fileKey,
        textCvContent: ''
      }
    })
  })

  if (!updateResponse.ok) {
    throw new Error(`Naukri profile resume update failed (${updateResponse.status}).`)
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
          .select('resume_url, resume_filename')
          .eq('user_id', userId)
          .single()
      ])

    if (credentialsError) throw credentialsError
    if (profileError) throw profileError

    const credential = (credentials?.[0] || null) as NaukriCredentials | null
    if (!credential?.username || !credential.password) {
      throw new Error('Naukri is not connected.')
    }
    if (!profile?.resume_url || !profile.resume_filename) {
      throw new Error('Upload a resume to JobPilot before enabling Naukri Auto Refresh.')
    }

    const cookies = await loginNaukri(credential.username, credential.password)
    const profileId = credential.profile_id || (await discoverProfileId(cookies))
    if (!profileId) {
      throw new Error('JobPilot could not detect your Naukri profile ID. Open Naukri Auto Refresh and add the profile ID once.')
    }

    const { data: resume, error: resumeError } = await admin.storage
      .from('resumes')
      .download(profile.resume_url)
    if (resumeError) throw resumeError

    await uploadResumeToNaukri(cookies, resume, profile.resume_filename, profileId)

    await admin.rpc('update_naukri_sync_status', {
      p_user_id: userId,
      p_status: 'connected',
      p_error: null,
      p_profile_id: profileId,
      p_synced: true
    })

    return { userId, ok: true }
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

    const cronToken = req.headers.get('x-jobpilot-cron')
    let userIds: string[] = []

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
      userIds = (connections || []).map((row: { user_id: string }) => row.user_id)
    } else {
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)

      const { data: { user }, error: userError } = await admin.auth.getUser(token)
      if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
      userIds = [user.id]
    }

    const results = []
    for (const userId of userIds) {
      results.push(await syncUser(admin, userId))
    }

    const successful = results.filter((result) => result.ok).length
    return jsonResponse({
      ok: true,
      attempted: results.length,
      successful,
      failed: results.length - successful,
      results
    })
  } catch (error) {
    console.error('[naukri-sync]', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Naukri sync failed' },
      500
    )
  }
})
