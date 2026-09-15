import { useCallback, useEffect, useRef } from 'react'

export default function useSectionNavigation(items, modalOpen) {
  const lockUntil = useRef(0)
  const lastWheel = useRef(0)
  const go = useCallback(id => {
    const section = document.getElementById(id)
    if (!section) return
    lockUntil.current = performance.now() + 850
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const editable = target => target.closest('input, textarea, select, [contenteditable="true"], .project-form, .modal-backdrop')
    const step = direction => {
      const header = window.innerWidth <= 760 ? 58 : 0
      const current = items.reduce((best, item, index) => {
        const distance = Math.abs(document.getElementById(item.id).getBoundingClientRect().top - header)
        return distance < best.distance ? { index, distance } : best
      }, { index: 0, distance: Infinity }).index
      go(items[Math.max(0, Math.min(items.length - 1, current + direction))].id)
    }
    const wheel = event => {
      if (modalOpen || event.defaultPrevented || event.ctrlKey || editable(event.target) || event.target.closest('.carousel-loop')) return
      if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      const now = performance.now()
      const continuedGesture = now - lastWheel.current < 180
      lastWheel.current = now
      if (continuedGesture || now < lockUntil.current) return
      step(Math.sign(event.deltaY))
    }
    const key = event => {
      if (modalOpen || event.defaultPrevented || editable(event.target) || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
      event.preventDefault()
      if (!event.repeat && performance.now() >= lockUntil.current) step(event.key === 'ArrowDown' ? 1 : -1)
    }
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key) }
  }, [items, modalOpen, go])
  return go
}
