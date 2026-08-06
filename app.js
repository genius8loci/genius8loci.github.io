import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"
import {
  getDatabase,
  ref,
  push,
  update,
  onChildAdded,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js"
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js"

// ==================== НАСТРОЙКИ ====================
const GITHUB_USERNAME = "genius8loci"

// Снимок, который обновляет GitHub Actions; при его недоступности — прямой запрос
const REPOS_SNAPSHOT = "repos.json"
const REPOS_API = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12`

const firebaseConfig = {
  apiKey: "AIzaSyB1v95LCjlcNStz1SXrMMY6ywtoPa53_fI",
  authDomain: "genius8loci-github-io.firebaseapp.com",
  databaseURL:
    "https://genius8loci-github-io-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "genius8loci-github-io",
  storageBucket: "genius8loci-github-io.firebasestorage.app",
  messagingSenderId: "529560479338",
  appId: "1:529560479338:web:2d1a265fe72c37396d0c13",
}
// ===================================================

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)
const auth = getAuth(app)

const MAX_LENGTH = 100
const URL_REGEX = /(https?:\/\/|www\.)/i

let currentUid = null
let currentIp = null

signInAnonymously(auth).catch((e) => console.error("Auth error:", e))
onAuthStateChanged(auth, (user) => {
  currentUid = user ? user.uid : null
})

fetch("https://api.ipify.org?format=json")
  .then((r) => r.json())
  .then((data) => {
    currentIp = (data.ip || "unknown").replace(/[.:]/g, "_")
  })
  .catch(() => {
    currentIp = "unknown"
  })

function showToast(msg) {
  const t = document.getElementById("toast")
  t.textContent = msg
  t.style.display = "block"
  setTimeout(() => (t.style.display = "none"), 3000)
}

// ---------- Тема оформления ----------
const themeToggleBtn = document.getElementById("theme-toggle")

function reflectToggleIcon() {
  themeToggleBtn.textContent =
    document.documentElement.getAttribute("data-theme") === "dark" ? "🌙" : "☀️"
}

reflectToggleIcon()

themeToggleBtn.addEventListener("click", () => {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark"
  document.documentElement.setAttribute("data-theme", next)
  try {
    localStorage.setItem("theme", next)
  } catch (e) {}
  reflectToggleIcon()
})

try {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      let stored = null
      try {
        stored = localStorage.getItem("theme")
      } catch (_) {}
      if (!stored) {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light"
        )
        reflectToggleIcon()
      }
    })
} catch (e) {}

// ---------- Звёздное небо ----------
function multipleBoxShadow(n, maxW, maxH) {
  const parts = []
  for (let i = 0; i < n; i++) {
    parts.push(
      `${Math.floor(Math.random() * maxW)}px ${Math.floor(
        Math.random() * maxH
      )}px var(--star-color)`
    )
  }
  return parts.join(",")
}

;(function initStars() {
  const fieldW = Math.max(
    window.innerWidth,
    document.documentElement.scrollWidth
  )
  const fieldH = window.innerHeight
  const small = window.innerWidth < 640
  const root = document.documentElement.style

  root.setProperty("--star-field-h", fieldH + "px")
  root.setProperty("--stars-sm", multipleBoxShadow(small ? 350 : 700, fieldW, fieldH))
  root.setProperty("--stars-md", multipleBoxShadow(small ? 100 : 200, fieldW, fieldH))
  root.setProperty("--stars-lg", multipleBoxShadow(small ? 50 : 100, fieldW, fieldH))
})()

// ---------- DVD-ник ----------
;(function setupDvdNickname() {
  const nickEl = document.getElementById("nickname")
  let active = false

  function start() {
    if (active) return
    active = true

    const rect = nickEl.getBoundingClientRect()
    const cs = getComputedStyle(nickEl)

    const clone = document.createElement("div")
    clone.id = "dvd-clone"
    clone.textContent = nickEl.textContent
    clone.style.fontSize = cs.fontSize
    clone.style.fontWeight = cs.fontWeight
    clone.style.fontFamily = cs.fontFamily
    document.body.appendChild(clone)
    nickEl.style.visibility = "hidden"

    let x = rect.left
    let y = rect.top
    let dirX = 1
    let dirY = 1
    const speed = 2.5
    let prevColor = ""

    function randomColor() {
      let c
      do {
        c = `hsl(${Math.floor(Math.random() * 360)}, 90%, 60%)`
      } while (c === prevColor)
      prevColor = c
      return c
    }

    clone.style.color = randomColor()

    function animate() {
      const w = clone.offsetWidth || 150
      const h = clone.offsetHeight || 40
      const maxX = window.innerWidth - w
      const maxY = window.innerHeight - h

      if (x <= 0 || x >= maxX) {
        dirX *= -1
        x = Math.max(0, Math.min(x, maxX))
        clone.style.color = randomColor()
      }
      if (y <= 0 || y >= maxY) {
        dirY *= -1
        y = Math.max(0, Math.min(y, maxY))
        clone.style.color = randomColor()
      }

      x += dirX * speed
      y += dirY * speed
      clone.style.left = x + "px"
      clone.style.top = y + "px"
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  nickEl.addEventListener("mouseenter", start)
})()

// ---------- Репозитории GitHub ----------

// Возвращает массив репозиториев либо null, если источник непригоден
async function fetchRepos(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) && data.length ? data : null
  } catch (e) {
    return null
  }
}

// Карточка собирается через DOM API — экранирование не требуется
function buildRepoCard(repo) {
  const card = document.createElement("div")
  card.className = "repo-card"

  const link = document.createElement("a")
  link.href = repo.html_url
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  link.textContent = repo.name
  card.appendChild(link)

  const desc = document.createElement("p")
  desc.textContent = repo.description || "Без описания"
  card.appendChild(desc)

  const meta = document.createElement("div")
  meta.className = "repo-meta"

  const stars = document.createElement("span")
  stars.textContent = `★ ${repo.stargazers_count}`

  const lang = document.createElement("span")
  lang.textContent = repo.language || "—"

  meta.append(stars, lang)
  card.appendChild(meta)

  return card
}

async function loadRepos() {
  const container = document.getElementById("repos")

  let repos = await fetchRepos(REPOS_SNAPSHOT)
  if (!repos) {
    console.warn("repos.json недоступен, запрос напрямую к GitHub API")
    repos = await fetchRepos(REPOS_API)
  }

  if (!repos) {
    container.textContent = "Не удалось загрузить репозитории."
    return
  }

  const fragment = document.createDocumentFragment()
  repos.forEach((repo) => fragment.appendChild(buildRepoCard(repo)))

  container.textContent = ""
  container.appendChild(fragment)
}

// ---------- Заметки ----------
function renderNote(id, note) {
  if (document.getElementById(`note-${id}`)) return

  const el = document.createElement("div")
  el.className = "note"
  el.id = `note-${id}`
  el.style.left = note.x + "%"
  el.style.top = note.y + "%"
  el.style.setProperty("--rot", (Math.random() * 6 - 3).toFixed(1) + "deg")
  el.style.background = `hsl(${Math.floor(Math.random() * 360)}, 85%, 80%)`
  el.textContent = note.text
  document.body.appendChild(el)
}

onChildAdded(ref(db, "notes"), (snapshot) => {
  renderNote(snapshot.key, snapshot.val())
})

// ---------- Форма добавления заметки ----------
let activeForm = null

function openNoteForm(pageX, pageY, targetEl) {
  if (
    targetEl &&
    (targetEl.closest(".repo-card") ||
      targetEl.closest(".note-form") ||
      targetEl.closest(".theme-toggle"))
  )
    return

  if (activeForm) activeForm.remove()

  const xPct = (pageX / document.documentElement.scrollWidth) * 100
  const yPct = (pageY / document.documentElement.scrollHeight) * 100

  const form = document.createElement("div")
  form.className = "note-form"
  form.style.left = Math.min(xPct, 70) + "%"
  form.style.top = yPct + "%"
  form.innerHTML = `
    <textarea maxlength="${MAX_LENGTH}" placeholder="Ваше сообщение…"></textarea>
    <div class="row">
      <span class="counter">0/${MAX_LENGTH}</span>
      <button type="button">Оставить</button>
    </div>`

  document.body.appendChild(form)
  activeForm = form

  const textarea = form.querySelector("textarea")
  const counter = form.querySelector(".counter")
  const button = form.querySelector("button")

  textarea.focus()
  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length}/${MAX_LENGTH}`
  })

  button.addEventListener("click", async () => {
    const text = textarea.value.trim()
    if (!text) return

    if (text.length > MAX_LENGTH) {
      showToast(`Максимум ${MAX_LENGTH} символов`)
      return
    }
    if (URL_REGEX.test(text)) {
      showToast("Ссылки запрещены")
      return
    }
    if (!currentUid) {
      showToast("Подождите, идёт авторизация…")
      return
    }
    if (!currentIp) {
      showToast("Подождите, определяется IP…")
      return
    }

    button.disabled = true
    button.textContent = "Отправка…"

    try {
      const noteRef = push(ref(db, "notes"))
      const updates = {}
      updates[`notes/${noteRef.key}`] = {
        x: xPct,
        y: yPct,
        text,
        ts: serverTimestamp(),
        ip: currentIp,
      }
      updates[`used_uids/${currentUid}`] = true
      updates[`used_ips/${currentIp}`] = true
      updates["meta/last_ts"] = serverTimestamp()
      await update(ref(db), updates)
      showToast("Сообщение сохранено")
    } catch (err) {
      let msg = err.message || "Не удалось сохранить сообщение"
      if (err.code === "PERMISSION_DENIED") {
        msg =
          "Нельзя: либо вы уже писали (браузер/IP), либо кто-то оставил запись меньше минуты назад"
      }
      showToast(msg)
    } finally {
      form.remove()
      activeForm = null
    }
  })

  document.addEventListener(
    "click",
    (ev) => {
      if (form.contains(ev.target)) return
      form.remove()
      if (activeForm === form) activeForm = null
    },
    { once: true, capture: true }
  )

  document.addEventListener(
    "touchend",
    (ev) => {
      if (form.contains(ev.target)) return
      form.remove()
      if (activeForm === form) activeForm = null
    },
    { once: true, capture: true }
  )
}

document.addEventListener("dblclick", (e) => {
  openNoteForm(e.pageX, e.pageY, e.target)
})

// Резервное определение двойного тапа — на случай, если touch-action: manipulation
// не даёт браузеру сгенерировать dblclick (старые мобильные браузеры)
let lastTapTime = 0
let lastTapX = 0
let lastTapY = 0
const DOUBLE_TAP_MS = 400
const DOUBLE_TAP_DIST = 40

document.addEventListener(
  "touchend",
  (e) => {
    if (e.target.closest(".note-form") || e.target.closest(".theme-toggle"))
      return

    const touch = e.changedTouches[0]
    if (!touch) return

    const now = Date.now()
    const dx = Math.abs(touch.pageX - lastTapX)
    const dy = Math.abs(touch.pageY - lastTapY)

    if (
      now - lastTapTime < DOUBLE_TAP_MS &&
      dx < DOUBLE_TAP_DIST &&
      dy < DOUBLE_TAP_DIST
    ) {
      e.preventDefault()
      lastTapTime = 0
      openNoteForm(touch.pageX, touch.pageY, e.target)
    } else {
      lastTapTime = now
      lastTapX = touch.pageX
      lastTapY = touch.pageY
    }
  },
  { passive: false }
)

loadRepos()
