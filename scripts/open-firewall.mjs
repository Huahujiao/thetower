/**
 * 开发前自动尝试开放 3000 端口防火墙规则
 * 需要管理员权限；非管理员运行时会提示并跳过，不影响 vite 启动
 */
import { execSync } from 'child_process'

const RULE_NAME = 'Vite Dev Port 3000'
const PORT = 3000

function ruleExists() {
  try {
    execSync(`netsh advfirewall firewall show rule name="${RULE_NAME}"`, {
      stdio: 'pipe'
    })
    return true
  } catch {
    return false
  }
}

function addRule() {
  const cmd = `netsh advfirewall firewall add rule name="${RULE_NAME}" dir=in action=allow protocol=TCP localport=${PORT}`
  execSync(cmd, { stdio: 'inherit' })
}

console.log(`\n[firewall] 检查端口 ${PORT} 防火墙规则...`)

if (ruleExists()) {
  console.log(`[firewall] 规则 "${RULE_NAME}" 已存在，跳过。\n`)
} else {
  try {
    addRule()
    console.log(`[firewall] 规则 "${RULE_NAME}" 已添加，端口 ${PORT} 已开放。\n`)
  } catch {
    console.warn(`[firewall] ⚠ 添加规则失败（需要管理员权限）。`)
    console.warn(`[firewall] 请以管理员身份运行: npm run firewall:setup`)
    console.warn(`[firewall] 或手动在 Windows 防火墙中开放 TCP ${PORT} 端口。\n`)
  }
}
