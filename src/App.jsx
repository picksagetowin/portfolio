import { useEffect, useMemo, useState } from 'react'
import Carousel from './Carousel'
import useSectionNavigation from './useSectionNavigation'
import { cloudConfigured, loadPortfolio, normalizeSession, readSession, refreshSession, saveProjects, saveSession, signIn, signOut } from './cloudSync'
import './App.css'
import './hero.css'
import './activity-preview.css'
import './projects.css'
import './scroll.css'

const pdfPath = '/CamScanner 2026. 09. 08. 11.17.pdf'
const pages = Array.from({ length: 13 }, (_, index) => index + 1)
const pageImagePath = page => `/activities/activity-${String(page).padStart(2, '0')}.jpg`
const navItems = [{ id: 'home', label: 'HOME', number: '01' }, { id: 'about', label: 'ABOUT', number: '02' }, { id: 'skills', label: 'SKILLS', number: '03' }, { id: 'activities', label: 'ACTIVITIES', number: '04' }, { id: 'projects', label: 'PROJECTS', number: '05' }]
const skills = [{ name: 'HTML5', image: '/skills/HTML5.webp', type: 'Markup' }, { name: 'CSS3', image: '/skills/css.svg', type: 'Styling' }, { name: 'JavaScript', image: '/skills/react.png', type: 'Frontend' }, { name: 'Python', image: '/skills/python.png', type: 'Language' }, { name: 'C', image: '/skills/c.webp', type: 'Language' }, { name: 'React', image: '/skills/react.png', type: 'Library' }]
const starterProjects = [{ title: '새 프로젝트', category: 'PERSONAL PROJECT', description: '프로젝트를 추가하고, 카드에서 상세 내용을 확인해 보세요.', detail: '이 영역에는 문제 정의, 사용 기술, 맡은 역할과 구현한 기능을 기록할 수 있습니다.', netlifyUrl: '', githubUrl: '' }]
const adminLoginId = 's1tgxy'

function InfoCard({ number, title, children }) { return <article><span>{number}</span><h3>{title}</h3><p>{children}</p></article> }
function ProjectModal({ project, onClose }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="project-modal" role="dialog" aria-modal="true" aria-label={project.title + ' 상세 정보'} onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="닫기">×</button><p className="eyebrow">{project.category}</p><h2>{project.title}</h2><p className="modal-description">{project.detail || project.description || '프로젝트 상세 내용을 준비 중입니다.'}</p><div className="modal-links">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer">GITHUB ↗</a>}{project.netlifyUrl && <a href={project.netlifyUrl} target="_blank" rel="noreferrer">PROJECT LINK ↗</a>}{!project.githubUrl && !project.netlifyUrl && <span>연결할 GitHub와 프로젝트 링크를 추가해 보세요.</span>}</div></section></div> }
function ActivityModal({ page, onClose }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="activity-modal" role="dialog" aria-modal="true" aria-label={`진로 활동 기록 ${page}페이지`} onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="닫기">×</button><img src={pageImagePath(page)} alt={`진로 활동 기록 ${page}페이지`} /></section></div> }
function cloudErrorMessage(error) {
  if (/portfolio_projects_shared|schema cache/i.test(error?.message || '')) return '공유 프로젝트 표가 아직 설정되지 않았어요. Supabase SQL Editor에서 supabase/schema.sql을 실행해 주세요.'
  return `동기화에 실패했어요: ${error?.message || '알 수 없는 오류'}`
}

function App() {
  const [active, setActive] = useState('home')
  const [projects, setProjects] = useState(() => { try { return JSON.parse(localStorage.getItem('portfolio-projects')) || starterProjects } catch { return starterProjects } })
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', detail: '', netlifyUrl: '', githubUrl: '' })
  const [session, setSession] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  useEffect(() => {
    if (!cloudConfigured || cloudReady) localStorage.setItem('portfolio-projects', JSON.stringify(projects))
  }, [cloudReady, projects])
  useEffect(() => {
    if (!cloudConfigured || session?.access_token) return
    let cancelled = false
    loadPortfolio().then(portfolio => {
      if (cancelled) return
      if (!portfolio) {
        setCloudStatus('공유 프로젝트 표가 아직 준비되지 않았어요. 관리자 설정을 확인해 주세요.')
        return
      }
      setOwnerId(portfolio.owner_id)
      setProjects(Array.isArray(portfolio.projects) ? portfolio.projects : [])
      if (!readSession()?.access_token) setCloudStatus(portfolio.initialized ? '모든 방문자에게 같은 프로젝트가 표시됩니다.' : '관리자 계정으로 한 번 로그인하면 이 기기의 프로젝트를 공유할 수 있어요.')
    }).catch(error => {
      if (!cancelled) setCloudStatus(cloudErrorMessage(error))
    })
    return () => { cancelled = true }
  }, [session?.access_token])
  useEffect(() => {
    if (!cloudConfigured) return
    let cancelled = false
    const restore = async () => {
      const stored = readSession()
      if (!stored?.access_token) return
      try {
        const current = stored.expires_at < Date.now() / 1000 + 60
          ? await refreshSession(stored.refresh_token)
          : stored
        if (!cancelled) { saveSession(current); setCloudReady(false); setCloudStatus('클라우드에서 프로젝트를 불러오는 중…'); setSession(current) }
      } catch {
        saveSession(null)
        if (!cancelled) setCloudStatus('로그인이 만료됐어요. 다시 로그인해 주세요.')
      }
    }
    restore()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!session?.access_token || !cloudConfigured) return
    const delay = Math.max(1000, (session.expires_at - Date.now() / 1000 - 60) * 1000)
    const timer = window.setTimeout(async () => {
      try {
        const next = await refreshSession(session.refresh_token)
        saveSession(next)
        setCloudReady(false)
        setCloudStatus('클라우드에서 프로젝트를 불러오는 중…')
        setSession(next)
      } catch {
        saveSession(null)
        setSession(null)
        setCloudStatus('로그인 세션이 만료됐어요. 다시 로그인해 주세요.')
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [session])
  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false
    const hydrate = async () => {
      try {
        const portfolio = await loadPortfolio(session.access_token)
        if (cancelled) return
        if (!portfolio) {
          setCloudReady(false)
          setCloudStatus('공유 프로젝트 표가 준비되지 않았어요. Supabase 설정 안내를 확인해 주세요.')
          return
        }
        setOwnerId(portfolio.owner_id)
        const isOwner = session.user.id === portfolio.owner_id
        let remoteProjects = Array.isArray(portfolio.projects) ? portfolio.projects : []
        if (isOwner && !portfolio.initialized) {
          const localProjects = JSON.parse(localStorage.getItem('portfolio-projects') || 'null') || starterProjects
          const initialized = await saveProjects(session.access_token, session.user.id, localProjects)
          if (cancelled) return
          remoteProjects = initialized.projects
        }
        setProjects(remoteProjects)
        setCloudReady(isOwner)
        setCloudStatus(isOwner ? '관리자 로그인됨 · 변경 사항을 모든 기기에 저장합니다.' : '공개 포트폴리오를 보고 있습니다. 수정 권한은 관리자에게만 있습니다.')
      } catch (error) {
        if (!cancelled) { setCloudReady(false); setCloudStatus(cloudErrorMessage(error)) }
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [session])
  useEffect(() => {
    if (!cloudReady || !session?.access_token || session.user.id !== ownerId) return
    const timer = window.setTimeout(async () => {
      setCloudStatus('클라우드에 저장 중…')
      try {
        await saveProjects(session.access_token, session.user.id, projects)
        setCloudStatus('모든 기기에 저장됨')
      } catch (error) {
        setCloudStatus(cloudErrorMessage(error))
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cloudReady, ownerId, projects, session])
  useEffect(() => { const observer = new IntersectionObserver(entries => { const found = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0]; if (found) setActive(found.target.id) }, { threshold: [.4,.7] }); navItems.forEach(({id}) => observer.observe(document.getElementById(id))); return () => observer.disconnect() }, [])
  const go = useSectionNavigation(navItems, Boolean(selectedProject || selectedActivity))
  const progress = useMemo(() => String(navItems.findIndex(item => item.id === active)+1).padStart(2,'0'), [active])
  const isOwner = Boolean(session?.user?.id && ownerId === session.user.id)
  const canManageProjects = isOwner && cloudReady
  const saveProject = e => {
    e.preventDefault()
    if (!canManageProjects || !form.title.trim()) return
    const project = { ...form, title: form.title.trim(), category: 'PERSONAL PROJECT' }
    setProjects(items => editingIndex === null ? [...items, project] : items.map((item, index) => index === editingIndex ? project : item))
    setForm({ title: '', description: '', detail: '', netlifyUrl: '', githubUrl: '' })
    setEditingIndex(null)
    setAdding(false)
  }
  const editProject = (project, index) => {
    setForm({ title: project.title || '', description: project.description || '', detail: project.detail || '', netlifyUrl: project.netlifyUrl || '', githubUrl: project.githubUrl || '' })
    setEditingIndex(index)
    setAdding(true)
    setSelectedProject(null)
  }
  const deleteProject = index => {
    if (!canManageProjects || !window.confirm('이 프로젝트를 목록에서 삭제할까요?')) return
    setProjects(items => items.filter((_, itemIndex) => itemIndex !== index))
    setSelectedProject(null)
  }
  const submitAuth = async event => {
    event.preventDefault()
    setAuthBusy(true)
    setCloudStatus('로그인 중…')
    try {
      const response = await signIn(authForm.username.trim(), authForm.password)
      if (!response.access_token || !response.user) throw new Error('관리자 계정이 아직 준비되지 않았어요. Supabase Auth 설정을 확인해 주세요.')
      const next = normalizeSession(response)
      saveSession(next)
      setCloudReady(false)
      setCloudStatus('클라우드에서 프로젝트를 불러오는 중…')
      setSession(next)
      setAuthOpen(false)
      setAuthForm({ username: '', password: '' })
      setCloudStatus('로그인됐어요. 프로젝트를 불러오는 중…')
    } catch (error) {
      setCloudStatus(`로그인에 실패했어요: ${error.message}`)
    } finally { setAuthBusy(false) }
  }
  const logout = async () => {
    try { await signOut(session?.access_token) } catch { /* Local session is still cleared. */ }
    saveSession(null)
    setSession(null)
    setCloudReady(false)
    setCloudStatus('로그아웃했어요. 이 기기에는 프로젝트 사본이 남아 있어요.')
  }
  return <main>
    <aside className="sidebar"><a className="brand" href="#home" onClick={e => {e.preventDefault();go('home')}}>DH<span>.</span></a><nav>{navItems.map(item => <button className={active===item.id?'nav-item active':'nav-item'} key={item.id} onClick={() => go(item.id)}><span>{item.number}</span>{item.label}</button>)}</nav><div className="sidebar-bottom">SCROLL <i /></div></aside>
    <div className="content">
      <section id="home" className="panel hero-panel"><p className="eyebrow hero-eyebrow">2026 · PERSONAL PORTFOLIO</p><p className="hero-index">{progress} <span>/ 05</span></p><div className="hero-copy"><p className="hero-label">STUDENT · WEB / SERVER</p><h1 className="hero-title">Portfolio</h1><p className="hero-subtitle">배우고, 기록하고, 직접 만든 것들을 모았습니다.</p></div><p className="hero-note">SCROLL TO EXPLORE <span>↓</span></p><button className="round-button" onClick={() => go('about')} aria-label="About으로 이동">↓</button></section>
      <section id="about" className="panel split-panel"><div className="section-title"><p className="eyebrow">01 · ABOUT ME</p><h2>나에 관해</h2></div><div className="about-grid"><InfoCard number="01" title="자기소개">노는게 제일 좋은 평범한 선린인고 학생이에요 ^-^</InfoCard><InfoCard number="02" title="관심 분야">웹개발, 서버</InfoCard><InfoCard number="03" title="강점">사회성,진실성,친절,유머,호기심</InfoCard><InfoCard number="04" title="목표">서울대!</InfoCard></div></section>
      <section id="skills" className="panel skills-panel"><div className="section-title"><p className="eyebrow">02 · SKILLS</p><h2>사용하는 언어</h2><p className="section-description">현재까지 익힌 언어들입니다.</p></div><div className="skills-grid">{skills.map((skill,index) => <article className="skill-card" key={skill.name+index}><span>{String(index+1).padStart(2,'0')}</span><img src={skill.image} alt="" /><div><h3>{skill.name}</h3><p>{skill.type}</p></div></article>)}</div></section>
      <section id="activities" className="panel activities-panel"><div className="section-title"><p className="eyebrow">03 · ACTIVITIES</p><h2>진로 활동 기록</h2><p className="section-description">활동지 위에서 스크롤하거나 드래그해 넘겨 보세요. 카드 밖에서 스크롤하면 다음 섹션으로 이동합니다.</p></div><Carousel className="activity-carousel" label="13페이지 활동지. 휠 또는 드래그하여 탐색" auto>{pages.map(page => <button className="paper" type="button" key={page} onClick={() => setSelectedActivity(page)} aria-label={`진로 활동 기록 ${page}페이지 확대 보기`}><img src={pageImagePath(page)} alt="" /><span className="paper-open">확대 보기 ↗</span></button>)}</Carousel><a className="pdf-callout" href={pdfPath} target="_blank" rel="noreferrer"><b>13페이지 활동지 전체 보기</b><span>PDF OPEN ↗</span></a></section>
      <section id="projects" className="panel projects-panel">
        <div className="projects-heading">
          <div className="section-title"><p className="eyebrow">04 · PROJECTS</p><h2>프로젝트</h2><p className="section-description">모든 방문자에게 같은 프로젝트가 보이고, 관리자만 추가하거나 수정할 수 있습니다.</p></div>
          <div className="project-actions">
            {canManageProjects && <button className="add-button" onClick={() => { setEditingIndex(null); setForm({ title: '', description: '', detail: '', netlifyUrl: '', githubUrl: '' }); setAdding(value => !value) }}>{adding ? 'CLOSE' : '+ ADD PROJECT'}</button>}
            {session ? <button className="sync-button" onClick={logout}>{isOwner ? '관리자 로그아웃' : '로그아웃'}</button> : <button className="sync-button" disabled={!cloudConfigured} onClick={() => setAuthOpen(value => !value)}>{cloudConfigured ? '관리자 로그인' : '클라우드 설정 필요'}</button>}
          </div>
        </div>
        {cloudStatus && <p className="cloud-status" role="status">{cloudStatus}</p>}
        {!cloudConfigured && <p className="cloud-help">클라우드 동기화를 위해 Supabase 설정을 확인해 주세요. <code>.env.example</code>과 <code>supabase/schema.sql</code>이 있습니다.</p>}
        {authOpen && cloudConfigured && <form className="auth-form" onSubmit={submitAuth}>
          <div className="auth-heading"><b>관리자 로그인</b><span>아이디: {adminLoginId}</span></div>
          <input required type="text" autoComplete="username" placeholder="아이디" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
          <input required type="password" autoComplete="current-password" placeholder="비밀번호" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          <button type="submit" disabled={authBusy}>{authBusy ? '잠시만 기다려 주세요…' : '로그인 →'}</button>
        </form>}
        {canManageProjects && adding && <form className="project-form" onSubmit={saveProject}>
          <input required placeholder="프로젝트 이름" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea placeholder="한 줄 소개" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <textarea placeholder="상세 설명" value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} />
          <input placeholder="프로젝트 링크 (선택)" value={form.netlifyUrl} onChange={e => setForm({ ...form, netlifyUrl: e.target.value })} />
          <input placeholder="GitHub 링크 (선택)" value={form.githubUrl} onChange={e => setForm({ ...form, githubUrl: e.target.value })} />
          <button type="submit">{editingIndex === null ? '프로젝트 추가 →' : '변경 사항 저장 →'}</button>
          {editingIndex !== null && <button type="button" onClick={() => { setAdding(false); setEditingIndex(null) }}>취소</button>}
        </form>}
        <Carousel className="project-carousel" label="프로젝트 목록. 드래그하여 탐색">{projects.map((project, index) => <div className="project-card-wrap" key={project.id || project.title + index}>
          <button className="project-card" onClick={() => setSelectedProject(project)}><span>{String(index + 1).padStart(2, '0')}</span><div className="project-preview">PROJECT<br />{String(index + 1).padStart(2, '0')}</div><p className="project-category">{project.category}</p><h3>{project.title}</h3><p>{project.description || '프로젝트 설명을 추가해 보세요.'}</p><strong>DETAIL ↗</strong></button>
          {canManageProjects && <div className="project-edit-actions"><button onClick={() => editProject(project, index)}>수정</button><button onClick={() => deleteProject(index)}>삭제</button></div>}
        </div>)}</Carousel>
      </section>
    </div>{selectedProject && <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />}{selectedActivity && <ActivityModal page={selectedActivity} onClose={() => setSelectedActivity(null)} />}
  </main>
}
export default App
