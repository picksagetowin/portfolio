import { Children, cloneElement, useEffect, useRef, useState } from 'react'

export default function Carousel({ children, className = '', label, auto = false }) {
  const viewport = useRef(null)
  const track = useRef(null)
  const controller = useRef(null)
  const gesture = useRef(null)
  const suppressClick = useRef(false)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const items = Children.toArray(children)

  useEffect(() => {
    const element = viewport.current
    let period = 0
    let position = 0
    let resumeAt = 0
    let visible = false
    let focused = false
    let frame
    let previous = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const normalize = value => auto && period
      ? period + ((value - period) % period + period) % period
      : Math.max(0, Math.min(value, element.scrollWidth - element.clientWidth))
    const move = delta => {
      position = normalize(position + delta)
      element.scrollLeft = position
    }
    const interact = () => { resumeAt = performance.now() + 1800 }
    controller.current = { move, interact, beginPointer: () => { focused = false; interact() } }
    const measure = () => {
      const oldPeriod = period
      const groups = track.current.children
      period = auto ? groups[1].offsetLeft - groups[0].offsetLeft : 0
      position = auto ? period + (oldPeriod ? (position - oldPeriod) / oldPeriod * period : 0) : element.scrollLeft
      move(0)
    }
    const resize = new ResizeObserver(measure)
    resize.observe(element)
    resize.observe(track.current)
    measure()
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    observer.observe(element)
    const wheel = event => {
      if (!auto || event.ctrlKey) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      interact()
      move(delta * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? element.clientWidth : 1))
    }
    const focusIn = () => { focused = !gesture.current; position = element.scrollLeft }
    const focusOut = event => { if (!element.contains(event.relatedTarget)) { focused = false; interact() } }
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('focusin', focusIn)
    element.addEventListener('focusout', focusOut)
    const tick = now => {
      const elapsed = previous ? Math.min(now - previous, 50) : 0
      previous = now
      if (auto && visible && !document.hidden && !gesture.current && !focused && !pausedRef.current && !reducedMotion.matches && now >= resumeAt) move(elapsed * .085)
      frame = requestAnimationFrame(tick)
    }
    if (auto) frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      observer.disconnect()
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('focusin', focusIn)
      element.removeEventListener('focusout', focusOut)
      controller.current = null
    }
  }, [auto, items.length])

  const down = event => {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    gesture.current = { x: event.clientX, y: event.clientY, lastX: event.clientX, dragging: false }
    controller.current.beginPointer()
  }
  const move = event => {
    const state = gesture.current
    if (!state) return
    const dx = event.clientX - state.x
    if (!state.dragging && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - state.y)) {
      state.dragging = true
      suppressClick.current = true
      viewport.current.setPointerCapture(event.pointerId)
      viewport.current.classList.add('is-dragging')
    }
    if (state.dragging) controller.current.move(state.lastX - event.clientX)
    state.lastX = event.clientX
  }
  const up = event => {
    if (viewport.current.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId)
    gesture.current = null
    viewport.current.classList.remove('is-dragging')
    controller.current.interact()
  }

  return <div className="carousel-shell">
    {auto && <div className="carousel-toolbar"><span>SCROLL / DRAG TO EXPLORE →</span><button type="button" aria-pressed={paused} onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current) }}>{paused ? '자동 이동 재생' : '자동 이동 일시정지'}</button></div>}
    <div className={`carousel ${className}${auto ? ' carousel-loop' : ''}`} aria-label={label} role="region" tabIndex={0} ref={viewport}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onPointerLeave={event => { if (gesture.current && !gesture.current.dragging) up(event) }}
      onDragStart={event => event.preventDefault()}
      onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false } }}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); controller.current.interact(); controller.current.move((event.key === 'ArrowRight' ? 1 : -1) * 223) } }}>
      <div className="carousel-track" ref={track}>{(auto ? [0, 1, 2] : [1]).map(copy => <div className="carousel-group" key={copy} aria-hidden={copy !== 1 || undefined}>{items.map(item => copy === 1 ? item : cloneElement(item, { tabIndex: -1 }))}</div>)}</div>
    </div>
  </div>
}
