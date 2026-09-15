const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const adminEmail = import.meta.env.VITE_SUPABASE_ADMIN_EMAIL?.trim().toLowerCase()
const adminLoginId = 's1tgxy'
const storageKey = 'portfolio-cloud-session'
const projectsEndpoint = '/rest/v1/portfolio_projects_shared'

export const cloudConfigured = Boolean(projectUrl && publicKey)

export const readSession = () => {
  try { return JSON.parse(localStorage.getItem(storageKey)) } catch { return null }
}

export const saveSession = session => {
  if (session) localStorage.setItem(storageKey, JSON.stringify(session))
  else localStorage.removeItem(storageKey)
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  if (!cloudConfigured) throw new Error('클라우드 연결 설정이 아직 완료되지 않았습니다.')
  const response = await fetch(projectUrl + path, {
    method,
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token || publicKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || `클라우드 요청 오류 (${response.status})`)
  return payload
}

export async function signIn(username, password) {
  if (username !== adminLoginId) throw new Error('아이디 또는 비밀번호를 확인해 주세요.')
  if (!adminEmail) throw new Error('관리자 이메일 설정이 없습니다. .env.local의 VITE_SUPABASE_ADMIN_EMAIL을 확인해 주세요.')
  return request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: adminEmail, password } })
}

export async function refreshSession(refreshToken) {
  const response = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })
  return normalizeSession(response)
}

export const normalizeSession = response => ({
  access_token: response.access_token,
  refresh_token: response.refresh_token,
  expires_at: response.expires_at || Math.floor(Date.now() / 1000) + response.expires_in,
  user: response.user,
})

export async function signOut(token) {
  if (token && cloudConfigured) await request('/auth/v1/logout', { method: 'POST', token })
}

export async function loadPortfolio(token) {
  const rows = await request(`${projectsEndpoint}?id=eq.1&select=id,owner_id,projects,initialized&limit=1`, { token })
  return rows[0] ?? null
}

export async function saveProjects(token, userId, projects) {
  const rows = await request(`${projectsEndpoint}?id=eq.1&owner_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    token,
    body: { projects, initialized: true, updated_at: new Date().toISOString() },
    headers: { Prefer: 'return=representation' },
  })
  if (!rows?.length) throw new Error('저장할 수 없습니다. 관리자 계정과 Supabase 권한 설정을 확인해 주세요.')
  return rows[0]
}
