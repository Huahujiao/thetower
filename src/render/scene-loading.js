// Startup bookkeeping stays independent of Vue and Three.js.
export const SCENE_LOAD_STAGES = Object.freeze([
  { id: 'modules', label: '准备三维模块' },
  { id: 'background', label: '绘制远山与天空' },
  { id: 'structure', label: '搭建场地与光照' },
  { id: 'tiles', label: '铺设地板与迷雾' },
  { id: 'actors', label: '放置角色与物品' },
])

export function nextScenePaint() {
  // Mobile browsers may suspend animation frames. Yield for painting when
  // available, but never make startup depend indefinitely on a frame callback.
  return new Promise(resolve => {
    let first, second, done = false
    const finish = () => {
      if (done) return
      done = true
      globalThis.clearTimeout(timer)
      if (first !== undefined) globalThis.cancelAnimationFrame?.(first)
      if (second !== undefined) globalThis.cancelAnimationFrame?.(second)
      resolve()
    }
    const timer = globalThis.setTimeout(finish, 250)
    if (typeof globalThis.requestAnimationFrame === 'function') {
      first = globalThis.requestAnimationFrame(() => { second = globalThis.requestAnimationFrame(finish) })
    }
  })
}

export function waitForSceneModule(promise, label, timeout = 90000) {
  let timer
  const deadline = new Promise((_, reject) => {
    timer = globalThis.setTimeout(() => reject(new Error(label + '超时，请检查连接后重新加载')), timeout)
  })
  return Promise.race([promise, deadline]).finally(() => globalThis.clearTimeout(timer))
}

export class SceneLoading {
  constructor(onChange = () => {}, { fetcher = (...args) => globalThis.fetch(...args), concurrency = 6, requestTimeout = 45000, decodeTimeout = 20000 } = {}) {
    this.onChange = onChange
    this.fetcher = fetcher
    this.concurrency = concurrency
    this.requestTimeout = requestTimeout
    this.decodeTimeout = decodeTimeout
    this.records = new Map()
    this.images = new Map()
    this.tasks = new Set()
    this.queue = []
    this.active = 0
    this.stage = 0
    this.work = 0
    this.detail = '显示加载界面'
    this.progress = 0
    this.closed = false
    this.controller = new globalThis.AbortController()
    this.objectUrls = new Set()
    if (typeof globalThis.PerformanceObserver === 'function') {
      this.observer = new globalThis.PerformanceObserver(list => {
        for (const entry of list.getEntries()) this.recordTiming(entry)
      })
      try { this.observer.observe({ type: 'resource', buffered: true }) }
      catch { this.observer.disconnect(); this.observer = null }
    }
    this.emit()
  }

  key(url) { return new globalThis.URL(url, globalThis.location?.href || 'http://localhost/').href }

  recordTiming(entry) {
    const key = this.key(entry.name)
    if (this.records.has(key) || !/^https?:/.test(key)) return
    this.records.set(key, { stage: this.stage, received: entry.encodedBodySize || entry.decodedBodySize || 0, size: entry.encodedBodySize || 0, done: true, failed: false })
    this.emit()
  }

  begin(id) {
    this.stage = SCENE_LOAD_STAGES.findIndex(stage => stage.id === id)
    if (this.stage < 0) throw new Error('Unknown scene loading stage: ' + id)
    this.work = 0
    this.detail = ''
    this.emit()
  }

  setDetail(detail) { this.detail = detail; this.emit() }

  setWork(done, total) { this.work = total ? done / total : 0; this.emit() }

  completeStage() { this.progress = Math.max(this.progress, (this.stage + 1) / SCENE_LOAD_STAGES.length); this.emit() }

  snapshot() {
    const all = [...this.records.values()]
    const current = all.filter(record => record.stage === this.stage)
    const part = current.length ? current.reduce((sum, record) => sum + (record.done ? 1 : record.size ? Math.min(.95, record.received / record.size) : 0), 0) / current.length : 0
    const local = Math.min(.95, this.work ? (part + this.work) / 2 : part)
    this.progress = Math.max(this.progress, (this.stage + local) / SCENE_LOAD_STAGES.length)
    return {
      stage: this.stage, label: SCENE_LOAD_STAGES[this.stage].label, detail: this.detail,
      progress: Math.round(this.progress * 100), total: all.length,
      completed: all.filter(record => record.done && !record.failed).length,
      failed: all.filter(record => record.failed).length,
      bytes: all.reduce((sum, record) => sum + record.received, 0),
    }
  }

  emit() { if (!this.closed) this.onChange(this.snapshot()) }

  track(promise) {
    this.tasks.add(promise)
    promise.then(() => this.tasks.delete(promise), () => this.tasks.delete(promise))
    return promise
  }

  arrayBuffer(url) {
    if (this.closed) return Promise.reject(new Error('Scene loading cancelled'))
    const key = this.key(url)
    const existing = this.records.get(key)
    if (existing?.promise) return existing.promise
    const record = existing || { stage: this.stage, received: 0, size: 0, done: false, failed: false }
    this.records.set(key, record)
    const promise = new Promise((resolve, reject) => this.queue.push({ url, record, resolve, reject }))
    record.promise = promise
    this.track(promise)
    this.pump()
    this.emit()
    return promise
  }

  pump() {
    while (!this.closed && this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()
      this.active++
      this.download(job).then(job.resolve, job.reject).finally(() => { this.active--; this.pump() })
    }
  }

  async download({ url, record }) {
    const controller = new globalThis.AbortController()
    const cancel = () => controller.abort(new Error('Scene loading cancelled'))
    this.controller.signal.addEventListener('abort', cancel, { once: true })
    let timer, reader
    const waiting = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
    })
    const heartbeat = () => {
      globalThis.clearTimeout(timer)
      timer = globalThis.setTimeout(() => controller.abort(new Error('资源响应超时：' + url)), this.requestTimeout)
    }
    try {
      heartbeat()
      const response = await Promise.race([this.fetcher(url, { signal: controller.signal }), waiting])
      heartbeat()
      if (!response.ok) throw new Error('Resource request failed: ' + response.status + ' ' + url)
      record.size = Number(response.headers.get('content-length')) || 0
      let result
      if (response.body?.getReader) {
        reader = response.body.getReader()
        const chunks = []
        let bytes = 0
        for (;;) {
          const { value, done } = await Promise.race([reader.read(), waiting])
          if (done) break
          heartbeat()
          chunks.push(value); bytes += value.byteLength
          record.received = Math.max(record.received, bytes); this.emit()
        }
        result = new Uint8Array(bytes)
        let offset = 0
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
        result = result.buffer
      } else {
        result = await Promise.race([response.arrayBuffer(), waiting]); record.received = Math.max(record.received, result.byteLength)
      }
      record.done = true; this.emit()
      return result
    } catch (error) {
      record.done = true; record.failed = true; this.emit()
      throw error
    } finally {
      globalThis.clearTimeout(timer)
      this.controller.signal.removeEventListener('abort', cancel)
      if (controller.signal.aborted) void reader?.cancel().catch(() => {})
    }
  }

  image(url) {
    const key = this.key(url)
    if (!this.images.has(key)) {
      const promise = this.arrayBuffer(url).then(buffer => new Promise((resolve, reject) => {
        if (this.closed) { reject(new Error('Scene loading cancelled')); return }
        const blobUrl = globalThis.URL.createObjectURL(new globalThis.Blob([buffer]))
        this.objectUrls.add(blobUrl)
        const image = document.createElement('img')
        let settled = false
        const finish = error => {
          if (settled) return
          settled = true
          globalThis.clearTimeout(timer)
          this.controller.signal.removeEventListener('abort', cancel)
          image.onload = image.onerror = null
          if (!error) { resolve(image); return }
          this.records.get(key).failed = true
          this.emit()
          globalThis.URL.revokeObjectURL(blobUrl)
          this.objectUrls.delete(blobUrl)
          reject(error)
        }
        const cancel = () => finish(new Error('Scene loading cancelled'))
        const timer = globalThis.setTimeout(() => finish(new Error('图片解码超时：' + url)), this.decodeTimeout)
        this.controller.signal.addEventListener('abort', cancel, { once: true })
        image.onload = () => finish()
        image.onerror = () => finish(new Error('Image decode failed: ' + url))
        image.src = blobUrl
      }))
      this.images.set(key, this.track(promise))
    }
    return this.images.get(key)
  }

  async idle() { while (this.tasks.size) await Promise.allSettled([...this.tasks]) }

  finish() {
    this.completeStage()
    this.observer?.disconnect()
    // Images retain their decoded source; release duplicate response buffers.
    for (const record of this.records.values()) delete record.promise
    this.onChange = () => {}
  }

  dispose() {
    this.closed = true
    this.observer?.disconnect()
    this.controller.abort()
    for (const job of this.queue.splice(0)) job.reject(new Error('Scene loading cancelled'))
    for (const url of this.objectUrls) globalThis.URL.revokeObjectURL(url)
    this.objectUrls.clear()
    this.images.clear()
  }
}
