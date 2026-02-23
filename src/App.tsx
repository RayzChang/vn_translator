import { useState, useCallback, useEffect } from 'react'
import {
  translateWithGemini,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  GEMINI_MODELS,
  AUDIENCE_LABELS,
  TONE_LABELS,
  type Region,
  type Gender,
  type Direction,
  type Audience,
  type Tone,
  type GeminiModelId
} from './lib/gemini'
import { estimateCost } from './lib/cost'
import { getHistory, addHistory, clearHistory, type HistoryItem } from './lib/history'
import { getStoredDark, setStoredDark } from './lib/theme'
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  apiLogin,
  apiRegister,
  apiGetSettings,
  apiSaveSettings,
  apiTranslate,
  type ApiUser
} from './lib/api'

/** 跟太太聊天：你（男生）對太太說話 → 男性、親暱 */
const PRESET_WIFE: { region: Region; gender: Gender; audience: Audience; tone: Tone } = {
  region: 'south',
  gender: 'male',
  audience: 'lover',
  tone: 'intimate'
}
const PRESET_ELDER: { region: Region; gender: Gender; audience: Audience; tone: Tone } = {
  region: 'south',
  gender: 'male',
  audience: 'elder',
  tone: 'polite'
}
const PRESET_COLLEAGUE: { region: Region; gender: Gender; audience: Audience; tone: Tone } = {
  region: 'south',
  gender: 'male',
  audience: 'colleague',
  tone: 'casual'
}
const PRESET_FORMAL: { region: Region; gender: Gender; audience: Audience; tone: Tone } = {
  region: 'south',
  gender: 'male',
  audience: 'none',
  tone: 'formal'
}

function App() {
  const [user, setUser] = useState<ApiUser | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [apiKey, setApiKey] = useState(getStoredApiKey)
  const [modelId, setModelId] = useState<GeminiModelId>(getStoredModel)
  const [dark, setDark] = useState(getStoredDark)
  const [showSettings, setShowSettings] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authLoginId, setAuthLoginId] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [historyList, setHistoryList] = useState<HistoryItem[]>(getHistory)
  const [direction, setDirection] = useState<Direction>('vn2zh')
  const [region, setRegion] = useState<Region>('south')
  const [gender, setGender] = useState<Gender>('male')
  const [audience, setAudience] = useState<Audience>('none')
  const [tone, setTone] = useState<Tone>('auto')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [explanation, setExplanation] = useState('')
  const [backTranslation, setBackTranslation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyToast, setCopyToast] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    setStoredDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    if (!token || !user) return
    apiGetSettings(token)
      .then((s) => {
        setModelId((s.modelId as GeminiModelId) || 'gemini-2.5-flash')
        if (s.preferences?.dark !== undefined) setDark(Boolean(s.preferences.dark))
      })
      .catch(() => {})
  }, [token, user])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (showHistory) setHistoryList(getHistory())
  }, [showHistory])

  useEffect(() => {
    if (showSettings) setSettingsError('')
  }, [showSettings])

  const handleTranslate = useCallback(async () => {
    setError('')
    setOutput('')
    setExplanation('')
    setBackTranslation('')
    setLoading(true)
    try {
      let result: { translation: string; explanation: string; backTranslation?: string }
      if (token && user) {
        result = await apiTranslate(token, input, {
          region,
          gender,
          direction,
          audience,
          tone,
          modelId
        })
      } else {
        result = await translateWithGemini(apiKey, input, {
          region,
          gender,
          direction,
          audience,
          tone,
          modelId
        })
      }
      setOutput(result.translation)
      setExplanation(result.explanation)
      setBackTranslation(result.backTranslation ?? '')
      addHistory({ input: input.trim(), output: result.translation, direction })
      setHistoryList(getHistory())
    } catch (e) {
      setError(e instanceof Error ? e.message : '翻譯失敗')
    } finally {
      setLoading(false)
    }
  }, [token, user, apiKey, input, region, gender, direction, audience, tone, modelId])

  const handleSaveSettings = async () => {
    setSettingsError('')
    if (token && user) {
      setSettingsSaving(true)
      try {
        await apiSaveSettings(token, {
          apiKey: apiKey || undefined,
          modelId,
          preferences: { dark }
        })
        if (apiKey) setStoredApiKey(apiKey)
        setShowSettings(false)
      } catch (e) {
        setSettingsError(e instanceof Error ? e.message : '同步失敗')
      } finally {
        setSettingsSaving(false)
      }
    } else {
      setStoredApiKey(apiKey)
      setStoredModel(modelId)
      setShowSettings(false)
    }
  }

  const handleLogout = () => {
    clearStoredAuth()
    setToken(null)
    setUser(null)
    setShowAuth(false)
  }

  const handleAuthSubmit = async (isRegister: boolean) => {
    setError('')
    const loginId = authLoginId.trim()
    const password = authPassword
    if (!loginId || loginId.length < 2) {
      setError('請輸入帳號（至少 2 個字元）')
      return
    }
    if (!password || password.length < 6) {
      setError(isRegister ? '請輸入密碼（至少 6 個字元）' : '請輸入密碼')
      return
    }
    setAuthLoading(true)
    try {
      const data = isRegister
        ? await apiRegister(loginId, password)
        : await apiLogin(loginId, password)
      setStoredAuth(data.token, data.user)
      setToken(data.token)
      setUser(data.user)
      setShowAuth(false)
      setAuthLoginId('')
      setAuthPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '失敗')
    } finally {
      setAuthLoading(false)
    }
  }

  const applyPreset = (p: { region: Region; gender: Gender; audience: Audience; tone: Tone }) => {
    setRegion(p.region)
    setGender(p.gender)
    setAudience(p.audience)
    setTone(p.tone)
  }

  const copyResult = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
    } catch {
      setError('無法複製')
    }
  }, [output])

  const swapInputOutput = useCallback(() => {
    if (!output) return
    setInput(output)
    setOutput('')
    setExplanation('')
    setBackTranslation('')
    setDirection((d) => (d === 'vn2zh' ? 'zh2vn' : 'vn2zh'))
  }, [output])

  const shareResult = useCallback(async () => {
    if (!output || !navigator.share) return
    try {
      await navigator.share({
        title: '台越翻譯',
        text: output
      })
    } catch {
      copyResult()
    }
  }, [output, copyResult])

  const startVoiceInput = useCallback(() => {
    const Win = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition
    if (!SR) {
      setError('此瀏覽器不支援語音輸入')
      return
    }
    const rec = new SR() as {
      lang: string
      continuous: boolean
      interimResults: boolean
      start: () => void
      onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null
      onend: (() => void) | null
      onerror: (() => void) | null
    }
    rec.lang = direction === 'vn2zh' ? 'vi-VN' : 'zh-TW'
    rec.continuous = false
    rec.interimResults = false
    setIsListening(true)
    setError('')
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      const t = last[0].transcript
      setInput((prev) => (prev ? `${prev} ${t}` : t))
      setIsListening(false)
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => {
      setError('語音辨識失敗')
      setIsListening(false)
    }
    rec.start()
  }, [direction])

  const openHistoryItem = useCallback((item: HistoryItem) => {
    setInput(item.input)
    setOutput(item.output)
    setBackTranslation('')
    setDirection(item.direction)
    setShowHistory(false)
  }, [])

  const handleClearHistory = useCallback(() => {
    clearHistory()
    setHistoryList([])
  }, [])

  const costEstimate = input.trim()
    ? estimateCost(modelId, input, output || input)
    : null

  const optionsSummary =
    audience !== 'none' || tone !== 'auto'
      ? [region === 'south' ? '南越' : '北越', gender === 'female' ? '女' : gender === 'male' ? '男' : '', audience !== 'none' ? AUDIENCE_LABELS[audience].replace(/（[^）]*）/g, '').trim() : '', tone !== 'auto' ? TONE_LABELS[tone] : '']
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <div className="min-h-screen app-bg text-slate-800 dark:text-slate-200 flex flex-col transition-colors">
      {/* 離線提示 */}
      {!isOnline && (
        <div className="bg-amber-500/95 backdrop-blur-sm text-white text-center py-2.5 text-sm px-4 shadow-sm">
          目前離線，需連線後才能翻譯
        </div>
      )}

      {/* 頂欄：漸層 + 玻璃 */}
      <header
        className="glass-header bg-gradient-to-r from-emerald-600/95 to-teal-600/95 dark:from-emerald-700/95 dark:to-teal-700/95 text-white flex items-center justify-between px-4 py-3 shadow-lg shadow-slate-900/5"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="w-9 h-9 rounded-xl bg-white/20 p-1 shadow-inner" />
          <h1 className="text-lg font-semibold tracking-tight drop-shadow-sm">台越翻譯機</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {user ? (
            <span className="text-sm text-white/90 mr-1 max-w-[100px] truncate" title={user.loginId}>
              {user.loginId}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => (user ? handleLogout() : setShowAuth(true))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-200 text-sm"
          >
            {user ? '登出' : '登入'}
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-200"
            aria-label="歷史紀錄"
          >
            <HistoryIcon />
          </button>
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-200"
            aria-label="翻譯選項"
          >
            <FilterIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-200"
            aria-label="設定"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========== 設定頁 ========== */}
      {showSettings && (
        <div className="flex-1 overflow-auto p-4 max-w-lg mx-auto w-full animate-fade-in">
          <div className="glass-card rounded-3xl shadow-card-hover dark:shadow-none p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">設定</h2>
            {user && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                已登入 · 金鑰與設定會同步到所有裝置
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              請至{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline">
                Google AI Studio
              </a>{' '}
              取得免費 API 金鑰。{user ? '儲存後會加密存於伺服器，多裝置共用。' : '金鑰僅存於本裝置。'}
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Gemini API 金鑰"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
              autoComplete="off"
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">使用模型</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value as GeminiModelId)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">建議選 Flash 系列：速度快、成本低。</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">深色模式</span>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                onClick={() => setDark((d) => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors ${dark ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${dark ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => { handleClearHistory(); setShowSettings(false) }}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600"
              >
                清除翻譯紀錄
              </button>
            </div>
            {settingsError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{settingsError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="btn-primary flex-1 py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsSaving ? '儲存中…' : '儲存並關閉'}
              </button>
              <button type="button" onClick={() => setShowSettings(false)} disabled={settingsSaving} className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 登入／註冊 ========== */}
      {showAuth && !showSettings && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in" onClick={() => setShowAuth(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm p-5 glass-card rounded-3xl shadow-2xl animate-slide-up border border-slate-200/60 dark:border-slate-700/80">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">登入 / 註冊</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">登入後可同步 API 金鑰與設定到所有裝置</p>
            <input
              type="text"
              value={authLoginId}
              onChange={(e) => setAuthLoginId(e.target.value)}
              placeholder="帳號（信箱或自訂）"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 mb-3"
              autoComplete="username"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="密碼（至少 6 字元）"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 mb-3"
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => handleAuthSubmit(false)} disabled={authLoading} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
                登入
              </button>
              <button type="button" onClick={() => handleAuthSubmit(true)} disabled={authLoading} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                註冊
              </button>
            </div>
            <button type="button" onClick={() => setShowAuth(false)} className="mt-3 w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
              取消
            </button>
          </div>
        </>
      )}

      {/* ========== 主畫面 ========== */}
      {!showSettings && (
        <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full main-content">
          <div className="flex rounded-2xl glass-card p-1.5 mb-3 shadow-card">
            <button
              type="button"
              onClick={() => setDirection('vn2zh')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${direction === 'vn2zh' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 active:scale-[0.98]'}`}
            >
              越 → 中
            </button>
            <button
              type="button"
              onClick={() => setDirection('zh2vn')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${direction === 'zh2vn' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 active:scale-[0.98]'}`}
            >
              中 → 越
            </button>
          </div>

          {optionsSummary && (
            <button type="button" onClick={() => setShowOptions(true)} className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/80 dark:border-slate-600/80 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all">
              <FilterIcon className="w-3.5 h-3.5" />
              {optionsSummary}
            </button>
          )}

          <div className="input-card glass-card rounded-3xl shadow-card border-slate-200/80 dark:border-slate-700/80 p-4 mb-3 transition-shadow duration-200">
            <div className="flex items-center gap-2 mb-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={direction === 'vn2zh' ? '貼上或輸入越南文…' : '輸入中文…'}
                rows={4}
                className="flex-1 w-full resize-none border-0 p-0 bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-0 focus:outline-none min-h-[100px]"
              />
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={isListening}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                aria-label="語音輸入"
              >
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
            </div>
            {costEstimate && (
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-0">
                <span>字數 {input.length}</span>
                <span>預估 Token 約 {costEstimate.inputTokens + costEstimate.outputTokens}</span>
                <span>預估花費 約 NT$ {costEstimate.twd < 0.01 ? '< 0.01' : costEstimate.twd.toFixed(2)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading || !input.trim() || !isOnline || (!user && !apiKey.trim())}
            className="btn-primary w-full py-4 rounded-2xl text-base min-h-[52px] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
          >
            {loading ? '翻譯中…' : '翻譯'}
          </button>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {direction === 'vn2zh' ? '中文' : '越南文'}
              </span>
              {output && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={swapInputOutput} className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="對調">
                    <SwapIcon />
                  </button>
                  {'share' in navigator && (
                    <button type="button" onClick={shareResult} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="分享">
                      分享
                    </button>
                  )}
                  <button type="button" onClick={copyResult} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium min-h-[44px] min-w-[44px] flex items-center justify-center">
                    複製
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-[100px] glass-card rounded-3xl shadow-card p-4 text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-auto">
              {output || (loading ? '…' : '')}
            </div>

            {/* 中→越時：回譯成中文約略意思，方便確認沒傳達錯 */}
            {direction === 'zh2vn' && backTranslation && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                回譯（約略意思）：{backTranslation}
              </p>
            )}

            {/* 解釋區塊：單字／文法／縮寫 */}
            {explanation && (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">解釋</p>
                <div className="glass-card rounded-3xl shadow-card p-4 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap overflow-auto border border-slate-200/60 dark:border-slate-700/80 [&>strong]:font-semibold [&>strong]:text-slate-800 dark:[&>strong]:text-slate-200">
                  <ExplanationText text={explanation} />
                </div>
              </div>
            )}
          </div>

          {copyToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-slate-800/95 dark:bg-slate-700/95 backdrop-blur-sm text-white text-sm shadow-lg z-50 animate-fade-in" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} role="status">
              已複製
            </div>
          )}
        </main>
      )}

      {/* ========== 選項面板 ========== */}
      {showOptions && !showSettings && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in" onClick={() => setShowOptions(false)} aria-hidden />
          <div className="fixed left-0 right-0 bottom-0 z-50 glass-card rounded-t-[1.75rem] shadow-2xl overflow-hidden options-panel border-b-0" role="dialog" aria-label="翻譯選項">
            <div className="sticky top-0 glass-card border-b border-slate-200/60 dark:border-slate-700/80 px-4 py-3 flex items-center justify-between rounded-t-[1.75rem]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">翻譯選項</h3>
              <button type="button" onClick={() => setShowOptions(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium rounded-xl hover:bg-emerald-500/10 transition-colors">完成</button>
            </div>
            <div className="overflow-auto p-4 pb-8 max-h-[70vh]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">快速預設</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <button type="button" onClick={() => applyPreset(PRESET_WIFE)} className="py-3.5 px-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/80 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 text-sm font-medium hover:shadow-card-hover active:scale-[0.98] transition-all text-left">
                  🌟 跟太太聊天
                </button>
                <button type="button" onClick={() => applyPreset(PRESET_ELDER)} className="py-3.5 px-4 rounded-2xl bg-slate-50/80 dark:bg-slate-700/30 border border-slate-200/80 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 text-sm font-medium hover:shadow-card-hover active:scale-[0.98] transition-all text-left">
                  對長輩（敬語）
                </button>
                <button type="button" onClick={() => applyPreset(PRESET_COLLEAGUE)} className="py-3.5 px-4 rounded-2xl bg-slate-50/80 dark:bg-slate-700/30 border border-slate-200/80 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 text-sm font-medium hover:shadow-card-hover active:scale-[0.98] transition-all text-left">
                  對同事
                </button>
                <button type="button" onClick={() => applyPreset(PRESET_FORMAL)} className="py-3.5 px-4 rounded-2xl bg-slate-50/80 dark:bg-slate-700/30 border border-slate-200/80 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 text-sm font-medium hover:shadow-card-hover active:scale-[0.98] transition-all text-left">
                  正式用
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">地區</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value as Region)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    <option value="south">南越（西貢）</option>
                    <option value="north">北越（河內）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">說話者性別</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    <option value="female">女性</option>
                    <option value="male">男性</option>
                    <option value="neutral">不區分</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">說話對象</label>
                  <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((key) => (
                      <option key={key} value={key}>{AUDIENCE_LABELS[key]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">語氣</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {(Object.keys(TONE_LABELS) as Tone[]).map((key) => (
                      <option key={key} value={key}>{TONE_LABELS[key]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== 歷史紀錄面板 ========== */}
      {showHistory && !showSettings && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in" onClick={() => setShowHistory(false)} aria-hidden />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 glass-card shadow-2xl overflow-hidden flex flex-col border-l border-slate-200/60 dark:border-slate-700/80 animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/80">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">翻譯紀錄</h3>
              <button type="button" onClick={() => setShowHistory(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">關閉</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {historyList.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">尚無紀錄</p>
              ) : (
                <ul className="space-y-2.5">
                  {historyList.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openHistoryItem(item)}
                        className="w-full text-left p-3.5 rounded-2xl glass-card hover:shadow-card-hover active:scale-[0.99] transition-all duration-200 border border-slate-200/60 dark:border-slate-700/80"
                      >
                        <span className="inline-block text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full mb-2">{item.direction === 'vn2zh' ? '越→中' : '中→越'}</span>
                        <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{item.input}</p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1.5 line-clamp-2">{item.output}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** 簡單將 **文字** 轉成粗體顯示 */
function ExplanationText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  )
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
function SwapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 20H3v-5" />
      <path d="M21 3l-7 7-4-4" />
      <path d="M3 21l7-7 4 4" />
    </svg>
  )
}
function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}
function MicOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" x2="23" y1="1" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

export default App
