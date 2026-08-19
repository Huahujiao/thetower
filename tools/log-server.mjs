// 黑塔 · 日志接收服务
// 纯 Node 原生 http，无第三方依赖。
// 启动：tools/start-log-server.bat（会自动提权开放防火墙并启动本服务）
// 或手动：node tools/log-server.mjs
//
// 接口：
//   GET  /            简单状态页
//   POST /log         Content-Type: application/json；body 为前端发来的日志对象
//                    收到后【覆盖写入】tools/logs/heita-log.txt（按用户要求：同一文件每次覆盖）
// CORS：全开（Access-Control-Allow-Origin: *），允许 localhost / 局域网 / Tailscale 设备跨域调用。

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.LOG_PORT || 7700)
const LOG_DIR = path.join(__dirname, 'logs')
const OUT_FILE = path.join(LOG_DIR, 'heita-log.txt')

fs.mkdirSync(LOG_DIR, { recursive: true })

const server = http.createServer((req, res) => {
  // —— CORS（含预检）——
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // —— 状态页 ——
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<h2>黑塔日志接收服务</h2>' +
      '<p>正在监听 <code>0.0.0.0:' + PORT + '</code></p>' +
      '<p>日志覆盖写入：<code>' + OUT_FILE + '</code></p>' +
      '<p>前端请 POST JSON 到 <code>/log</code></p>'
    )
    return
  }

  // —— 接收日志 ——
  if (req.method === 'POST' && req.url.startsWith('/log')) {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 5e6) req.destroy() // 防过大，5MB 上限
    })
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}')
        const log = Array.isArray(data.log) ? data.log : []
        const p = data.player || {}
        const lines = []
        lines.push('================= 黑塔日志 =================')
        lines.push('接收时间 : ' + new Date().toLocaleString('zh-CN'))
        lines.push('发送时间 : ' + (data.sentAt || '-'))
        lines.push('来源页   : ' + (data.url || '-'))
        lines.push('楼层/回合: ' + (data.floor ?? '-') + ' / ' + (data.turn ?? '-'))
        lines.push('生存状态 : HP ' + (p.hp ?? '-') + '/' + (p.maxHp ?? '-') +
                   '  SAN ' + (p.san ?? '-') + '/' + (p.maxSan ?? '-') +
                   '  金币 ' + (p.gold ?? '-') + '  钥匙 ' + (p.keys ?? '-'))
        lines.push('---- 日志 (' + log.length + ' 条) ----')
        for (const l of log) lines.push(String(l))
        lines.push('')
        lines.push('')

        fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8') // 覆盖写同一文件
        console.log('[log] 已接收并覆盖写入 ' + OUT_FILE + '（' + log.length + ' 条）')

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, count: log.length }))
      } catch (e) {
        console.error('[log] 解析失败:', e.message)
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('黑塔日志接收服务已启动: http://0.0.0.0:' + PORT)
  console.log('（如需外部/Tailscale 设备访问，请确保防火墙已放行 TCP ' + PORT + '）')
  console.log('日志覆盖写入: ' + OUT_FILE)
})
