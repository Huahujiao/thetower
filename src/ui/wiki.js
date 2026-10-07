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
    <div class="wiki-directory-grid">${pages.map((page) => `<a class="wiki-directory-link" href="/wiki/${page.id}">
      <strong>${escapeHtml(page.title)}</strong><span class="wiki-directory-arrow" aria-hidden="true">→</span>
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
    if (this.page?.id === 'items') document.body.classList.add('wiki-items-page')
    document.title = this.page ? `${this.page.title} · ${WIKI_TITLE}` : WIKI_TITLE
    this._build()
    if (this.page) this._renderPage()
  }

  _build() {
    const page = this.page
    const title = page?.title || (this.id ? '页面不存在' : WIKI_TITLE)
    this.root.innerHTML = `<main class="wiki-shell">
      <header class="wiki-header">
        <a class="wiki-back" href="${page || this.id ? '/wiki' : '/'}" aria-label="${page || this.id ? '返回目录' : '返回游戏'}">←</a>
        <div class="wiki-heading"><h1>${escapeHtml(title)}</h1></div>
      </header>
      ${page || this.id ? '<nav class="wiki-breadcrumb"><a href="/wiki">图鉴目录</a><span aria-hidden="true">/</span><span>' + escapeHtml(title) + '</span></nav>' : ''}
      ${page?.section === 'planning' ? '<p class="wiki-planning-note">此页区分当前问题与未实现候选；具体玩法请参阅规则页和实时清单。</p>' : ''}
      <div data-wiki-content>${!page && !this.id ? WIKI_SECTIONS.map(directorySection).join('') : !page ? '<p class="wiki-loading">请从 <a href="/wiki">图鉴目录</a>选择页面。</p>' : '<p class="wiki-loading">正在加载…</p>'}</div>
    </main>`
    this.content = this.root.querySelector('[data-wiki-content]')
  }

  async _renderPage() {
    try {
      if (this.page.id === 'items') {
        const [{ createApp }, { default: WikiItems }] = await Promise.all([import('vue'), import('./WikiItems.vue')])
        if (this.disposed) return
        this.content.className = 'wiki-items-content'
        this.content.innerHTML = ''
        this.itemsApp = createApp(WikiItems)
        this.itemsApp.mount(this.content)
        return
      } else if (this.page.load) {
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
    this.disposed = true
    this.itemsApp?.unmount()
    document.body.classList.remove('wiki-page', 'wiki-items-page')
  }
}
