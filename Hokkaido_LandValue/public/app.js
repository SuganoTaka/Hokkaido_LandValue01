const HOKKAIDO_CENTER = [43.5, 142.5]
const state = {
  map: null,
  points: [],
  markers: [],
}

const elements = {
  announcementFilter: document.querySelector('#filter-announcement'),
  announcementYear: document.querySelector('#announcement-year'),
  loadStatus: document.querySelector('#load-status'),
  map: document.querySelector('#map'),
  mapMessage: document.querySelector('#map-message'),
  municipality: document.querySelector('#municipality'),
  resetView: document.querySelector('#reset-view'),
  resultCount: document.querySelector('#result-count'),
  results: document.querySelector('.results'),
  search: document.querySelector('#search'),
  surveyFilter: document.querySelector('#filter-survey'),
  surveyYear: document.querySelector('#survey-year'),
}

function showError(message) {
  elements.mapMessage.textContent = message
  elements.mapMessage.hidden = false
  elements.resultCount.textContent = '地図を表示できません'
  elements.loadStatus.textContent = message
  elements.results.classList.add('error')
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja')
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function formatPrice(point) {
  return `${new Intl.NumberFormat('ja-JP').format(point.price)}${point.priceUnit}`
}

function markerContent(point) {
  const kind = point.type === 'announcement' ? '地価公示' : '都道府県地価調査'
  const change = Number.isFinite(point.changeRate)
    ? `対前年 ${point.changeRate > 0 ? '+' : ''}${point.changeRate.toFixed(1)}%`
    : '対前年変動率：公表なし'
  const area = Number.isFinite(point.areaM2)
    ? `${new Intl.NumberFormat('ja-JP').format(point.areaM2)}㎡`
    : ''
  const station = point.nearestStation
    ? `最寄駅等：${escapeHtml(point.nearestStation)}`
    : ''
  const use = point.use ? `用途：${escapeHtml(point.use)}` : ''
  const tags = [escapeHtml(kind), `${point.year}年`, change, area]
    .filter(Boolean)
    .map(tag => `<span>${tag}</span>`)
    .join('')

  return `<div class="price-info">
    <div class="price-info-heading">
      <i class="source-dot ${point.type}"></i>
      ${escapeHtml(kind)}・${point.year}年
    </div>
    <h2>${escapeHtml(point.pointName || point.municipality)}</h2>
    <div class="price-info-price">${escapeHtml(formatPrice(point))}<small>${escapeHtml(change)}</small></div>
    <div class="price-info-address">${escapeHtml(point.address)}</div>
    <div class="price-info-meta">${tags}</div>
    ${use || station ? `<p class="price-info-use">${[use, station].filter(Boolean).join(' / ')}</p>` : ''}
  </div>`
}

function matchesFilters(point) {
  const typeEnabled = point.type === 'announcement'
    ? elements.announcementFilter.checked
    : elements.surveyFilter.checked
  if (!typeEnabled) return false

  const municipality = elements.municipality.value
  if (municipality && point.municipality !== municipality) return false

  const query = normalizeText(elements.search.value.trim())
  if (!query) return true

  return normalizeText([
    point.municipality,
    point.pointName,
    point.address,
    point.use,
    point.nearestStation,
  ].join(' ')).includes(query)
}

function updateVisiblePoints() {
  if (!state.map) return
  state.map.closePopup()
  let visibleCount = 0
  const visibleMunicipalities = new Set()
  for (const entry of state.markers) {
    const visible = matchesFilters(entry.point)
    if (visible && !state.map.hasLayer(entry.marker)) entry.marker.addTo(state.map)
    if (!visible && state.map.hasLayer(entry.marker)) state.map.removeLayer(entry.marker)
    if (visible) {
      visibleCount += 1
      visibleMunicipalities.add(entry.point.municipality)
    }
  }
  elements.resultCount.textContent = `${visibleCount.toLocaleString('ja-JP')} / ${state.points.length.toLocaleString('ja-JP')} 地点を表示`
  elements.loadStatus.textContent = visibleCount
    ? `${visibleMunicipalities.size.toLocaleString('ja-JP')}自治体の地点。マーカーにマウスを合わせて価格を確認`
    : '条件に一致する地点がありません'
}

function populateMunicipalities(points) {
  const municipalities = [...new Set(points.map(point => point.municipality))].sort((a, b) => a.localeCompare(b, 'ja'))
  for (const municipality of municipalities) {
    const option = document.createElement('option')
    option.value = municipality
    option.textContent = municipality
    elements.municipality.append(option)
  }
}

function addMarkers(points) {
  state.markers = points.map(point => {
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      className: `land-price-marker ${point.type}`,
      fillOpacity: 1,
      color: '#ffffff',
      weight: 2,
    })
    const content = markerContent(point)
    marker.bindTooltip(content, { direction: 'top', opacity: 1, className: 'land-price-tooltip' })
    marker.bindPopup(content, { maxWidth: 350 })
    marker.on('add', () => {
      const element = marker.getElement()
      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
      element.setAttribute('aria-label', `${formatPrice(point)} / ${point.municipality}・${point.pointName || point.address}`)
    })
    marker.on('keypress', event => {
      if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') marker.openPopup()
    })
    return { point, marker }
  })
}

async function loadApplication() {
  try {
    if (typeof L === 'undefined') throw new Error('地図ライブラリを読み込めません。ネットワーク接続を確認してください。')
    const dataResponse = await fetch('/data/land-values.json')
    if (!dataResponse.ok) throw new Error('地点データを読み込めません。public/data/land-values.json を確認してください。')
    const data = await dataResponse.json()
    if (!Array.isArray(data.points) || data.points.length === 0) {
      throw new Error('地点データがありません。public/data/land-values.json を確認してください。')
    }

    elements.announcementYear.textContent = `${data.sources.announcement.year}年`
    elements.surveyYear.textContent = `${data.sources.survey.year}年`
    state.points = data.points
    state.map = L.map(elements.map).setView(HOKKAIDO_CENTER, 6)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
    tiles.on('tileerror', () => {
      elements.mapMessage.textContent = '地図画像を取得できません。ネットワーク接続を確認してください。'
      elements.mapMessage.hidden = false
    })
    elements.mapMessage.hidden = true
    tiles.addTo(state.map)
    populateMunicipalities(state.points)
    addMarkers(state.points)
    updateVisiblePoints()
  } catch (error) {
    showError(error.message)
  }
}

elements.search.addEventListener('input', updateVisiblePoints)
elements.municipality.addEventListener('change', updateVisiblePoints)
elements.announcementFilter.addEventListener('change', updateVisiblePoints)
elements.surveyFilter.addEventListener('change', updateVisiblePoints)
elements.resetView.addEventListener('click', () => {
  if (!state.map) return
  state.map.setView(HOKKAIDO_CENTER, 6)
})

loadApplication()
