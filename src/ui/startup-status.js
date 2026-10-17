// This module has no UI/renderer dependency, so startup failures stay readable.
export function finishStartup() {
  document.getElementById('startup-screen')?.remove()
}

export function failStartup(error) {
  console.error('Page startup failed:', error)
  const screen = document.getElementById('startup-screen')
  if (!screen) return
  screen.dataset.state = 'error'
  document.getElementById('startup-message').textContent = '页面暂时没有加载完成'
  document.getElementById('startup-detail').textContent = '请检查网络连接后重新加载。'
  document.getElementById('startup-retry').hidden = false
}
