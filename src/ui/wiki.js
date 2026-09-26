import { WIKI_SECTIONS, WIKI_PAGES, WIKI_PAGE_BY_ID } from './wiki-pages.js'
import '../wiki.css'

const WIKI_TITLE = '地牢 Wiki'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
}

function directorySection(section) {
  const pages = WIKI_PAGES.filter((page) => page.section === section.id)
  return `<section class="wiki-directory-section" aria-labelledby="wiki-section-${section.id}">
    <h2 id="wiki-section-${section.id}">${escapeHtml(section.title)}</h2>
    <p>${escapeHtml(section.description)}</p>
    <div class="wiki-directory-grid">${pages.map((page) => `<a class="wiki-directory-link" href="/wiki/${page.id}">
      <strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.summary)}</span><span class="wiki-directory-arrow" aria-hidden="true">→</span>
    </a>`).join('')}</div>
  </section>`
}

export class WikiPage {
  constructor(root = document.getElementById('hud')) {
    if (!root) throw new Error('Missing #hud container')
    this.root = root
    const legacyId = window.location.hash.slice(1)
    if (window.location.pathname.replace(/\/$/, '') === '/wiki' && WIKI_PAGE_BY_ID.has(legacyId)) {
      window.history.replaceState(null, '', `/wiki/${legacyId}`)
    }
    this.id = window.location.pathname.replace(/\/$/, '').split('/')[2] || ''
    this.page = WIKI_PAGE_BY_ID.get(this.id)
    document.body.classList.add('wiki-page')
    document.title = this.page ? `${this.page.title} · ${WIKI_TITLE}` : WIKI_TITLE
    this._build()
    if (this.page) this._renderPage()
  }

  _build() {
    const page = this.page
    const section = WIKI_SECTIONS.find((entry) => entry.id === page?.section)
    const title = page?.title || (this.id ? '页面不存在' : WIKI_TITLE)
    const summary = page?.summary || (this.id ? '此页面没有对应的 Wiki 内容。' : '游戏规则、内容清单、构筑思路与开发资料。')
    this.root.innerHTML = `<main class="wiki-shell">
      <header class="wiki-header">
        <a class="wiki-back" href="${page || this.id ? '/wiki' : '/'}" aria-label="${page || this.id ? '返回目录' : '返回游戏'}">←</a>
        <div class="wiki-heading"><div class="wiki-kicker">${escapeHtml(section?.title || '目录')}</div><h1>${escapeHtml(title)}</h1><p class="wiki-summary">${escapeHtml(summary)}</p></div>
      </header>
      ${page || this.id ? '<nav class="wiki-breadcrumb"><a href="/wiki">图鉴目录</a><span aria-hidden="true">/</span><span>' + escapeHtml(title) + '</span></nav>' : ''}
      ${page?.section === 'planning' ? '<p class="wiki-planning-note">此页为规划或素材记录，可能包含尚未实现或已被替换的内容；当前规则与数值请参阅玩法页和实时清单。</p>' : ''}
      <div data-wiki-content>${!page && !this.id ? WIKI_SECTIONS.map(directorySection).join('') : !page ? '<p class="wiki-loading">请从 <a href="/wiki">图鉴目录</a>选择页面。</p>' : '<p class="wiki-loading">正在加载…</p>'}</div>
    </main>`
    this.content = this.root.querySelector('[data-wiki-content]')
  }

  async _renderPage() {
    try {
      if (this.page.load) {
        const [{ default: markdown }, { marked }] = await Promise.all([this.page.load(), import('marked')])
        this.content.className = 'wiki-article'
        this.content.innerHTML = marked.parse(markdown.replace(/^# .+\n/, ''))
        this.content.querySelectorAll('table').forEach((table) => {
          const scroller = document.createElement('div')
          scroller.className = 'wiki-table-scroll'
          table.replaceWith(scroller)
          scroller.append(table)
        })
      } else {
        const { catalogContent } = await import('./wiki-catalog.js')
        this.content.className = 'wiki-content'
        this.content.innerHTML = catalogContent(this.page.id)
      }
      this.content.insertAdjacentHTML('beforeend', '<p class="wiki-bottom-link"><a href="/wiki">← 返回目录</a></p>')
    } catch (error) {
      this.content.innerHTML = '<p class="wiki-loading">内容加载失败。请刷新页面重试。</p>'
      console.error(error)
    }
  }

  dispose() {
    document.body.classList.remove('wiki-page')
  }
}
