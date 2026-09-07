import { useState, useEffect, useRef } from 'react'
import { WebWorkerMLCEngine, prebuiltAppConfig, hasModelInCache, deleteModelAllInfoInCache } from '@mlc-ai/web-llm'
import { Download, Settings, Cpu, CheckCircle2, Moon, Sun, Brain, Copy, ArrowUp, Loader2, ChevronDown, Menu, Plus, MessageSquare, Trash2, X, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type ChatMessageContent = string | { type: string, text?: string, image_url?: { url: string } }[]

interface ChatSession {
  id: string
  title: string
  messages: {role: string, content: ChatMessageContent, attachedFiles?: Attachment[]}[]
  timestamp: number
  modelId: string
}

export interface Attachment {
  id: string
  fileName: string
  type: 'image' | 'text' | 'pdf'
  content: string
}

interface ModelInfo {
  id: string
  name: string
  size: string
  vramMB: number
}

const RAW_MODELS = [
  // Petits Modèles (< 2 Go)
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 (1B)', size: '880 Mo' },
  { id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC', name: 'TinyLlama (1.1B)', size: '1.20 Go' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (1.5B)', size: '1.63 Go' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 (2B)', size: '1.89 Go' },
  
  // Modèles Moyens (2 à 5 Go)
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 (3B)', size: '2.26 Go' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (3B)', size: '2.50 Go' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini', size: '3.67 Go' },
  { id: 'Phi-3.5-vision-instruct-q4f16_1-MLC', name: 'Phi-3.5 Vision', size: '3.80 Go' },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', name: 'Mistral v0.3 (7B)', size: '4.57 Go' },

  // Grands Modèles (5 à 10 Go)
  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', name: 'Llama 3.1 (8B)', size: '5.00 Go' },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (7B)', size: '5.10 Go' },
  { id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC', name: 'DeepSeek R1 (7B)', size: '5.10 Go' },
  { id: 'gemma-2-9b-it-q4f16_1-MLC', name: 'Gemma 2 (9B)', size: '6.42 Go' }
]

const AVAILABLE_MODELS: ModelInfo[] = RAW_MODELS.map(m => {
  const conf = prebuiltAppConfig.model_list.find(item => item.model_id === m.id)
  return {
    ...m,
    vramMB: conf?.vram_required_MB ? Math.round(conf.vram_required_MB) : 1500
  }
})

interface GpuHardwareInfo {
  gpuName: string
  tier: 'low' | 'medium' | 'high'
  estimatedVramMB: number
  recommendedModelId: string
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : 'text'
  const codeString = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([codeString], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    let ext = 'txt'
    if (language === 'python') ext = 'py'
    else if (language === 'javascript' || language === 'js') ext = 'js'
    else if (language === 'typescript' || language === 'ts') ext = 'ts'
    else if (language === 'html') ext = 'html'
    else if (language === 'css') ext = 'css'
    else if (language === 'json') ext = 'json'
    else ext = language
    a.download = `snippet.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (inline || !match) {
    return <code {...props} className={`${className} bg-slate-200/60 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded-md text-[0.85em] font-mono`}>{children}</code>
  }

  return (
    <div className="rounded-xl overflow-hidden my-4 border border-[#2d2d2d] bg-[#1e1e1e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-[#2d2d2d]">
         <span className="text-[13px] font-semibold text-slate-300 capitalize font-sans">{language}</span>
         <div className="flex items-center gap-2 text-slate-400">
           <button onClick={handleDownload} title="Télécharger" className="cursor-pointer hover:text-slate-100 transition-colors p-1.5 hover:bg-slate-700 rounded-md">
             <Download size={14} strokeWidth={2.5} />
           </button>
           <button onClick={handleCopy} title="Copier" className="cursor-pointer hover:text-slate-100 transition-colors p-1.5 hover:bg-slate-700 rounded-md">
             {copied ? <CheckCircle2 size={14} className="text-emerald-400" strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2.5} />}
           </button>
         </div>
      </div>
      <div className="overflow-x-auto text-[13px]">
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, background: 'transparent', padding: '1.25rem', fontSize: '13px', lineHeight: '1.5' }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark'
  })
  const [hardwareInfo, setHardwareInfo] = useState<GpuHardwareInfo | null>(null)
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set())
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('selectedModel')
    if (saved && AVAILABLE_MODELS.find(m => m.id === saved)) return saved
    return AVAILABLE_MODELS[0].id
  })
  
  const [engine, setEngine] = useState<WebWorkerMLCEngine | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadedModel, setLoadedModel] = useState<string | null>(null)
  const [messages, setMessages] = useState<{role: string, content: ChatMessageContent, attachedFiles?: Attachment[]}[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [generating, setGenerating] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chatHistory')
    return saved ? JSON.parse(saved) : []
  })
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [modelToDelete, setModelToDelete] = useState<ModelInfo | null>(null)
  const [diskSpace, setDiskSpace] = useState<number | null>(null)
  
  const [bgDownloadingModel, setBgDownloadingModel] = useState<string | null>(null)
  const [bgProgress, setBgProgress] = useState(0)
  const [bgProgressText, setBgProgressText] = useState('')
  
  const modelPickerRef = useRef<HTMLDivElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        if (est.quota && est.usage) {
           setDiskSpace(est.quota - est.usage)
        }
      }).catch(() => {})
    }
  }, [])

  // Sauvegarde automatique des messages
  useEffect(() => {
    if (messages.length === 0) return
    const timeout = setTimeout(() => {
      setChatHistory(prev => {
        let updated: ChatSession[]
        const existingIdx = prev.findIndex(c => c.id === currentChatId)
        
        if (existingIdx !== -1) {
          updated = [...prev]
          updated[existingIdx] = { ...updated[existingIdx], messages, timestamp: Date.now(), modelId: selectedModel }
        } else {
          const newId = Date.now().toString()
          const title = messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : '')
          setCurrentChatId(newId)
          updated = [{ id: newId, title, messages, timestamp: Date.now(), modelId: selectedModel }, ...prev]
        }
        localStorage.setItem('chatHistory', JSON.stringify(updated))
        return updated
      })
    }, 500)
    return () => clearTimeout(timeout)
  }, [messages, currentChatId, selectedModel])

  const startNewChat = () => {
    setMessages([])
    setCurrentChatId(null)
    setShowSidebar(false)
  }

  const loadChat = (chat: ChatSession) => {
    setMessages(chat.messages)
    setCurrentChatId(chat.id)
    if (chat.modelId && chat.modelId !== selectedModel) {
      setSelectedModel(chat.modelId)
    }
    setShowSidebar(false)
  }

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setChatHistory(prev => {
      const updated = prev.filter(c => c.id !== id)
      localStorage.setItem('chatHistory', JSON.stringify(updated))
      return updated
    })
    if (currentChatId === id) {
      setMessages([])
      setCurrentChatId(null)
    }
  }

  const rollbackAndEdit = (index: number) => {
    if (generating || loading) return
    const messageToEdit = messages[index].content
    const textContent = Array.isArray(messageToEdit) 
      ? messageToEdit.filter(p => p.type === 'text').map(p => p.text).join('\n') 
      : messageToEdit
    setInput(textContent)
    setMessages(prev => prev.slice(0, index))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)
    
    for (const file of files) {
      const id = Date.now().toString() + Math.random().toString(36).substring(7)
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setAttachments(prev => [...prev, { id, fileName: file.name, type: 'image', content: e.target?.result as string }])
        }
        reader.readAsDataURL(file)
      } else if (file.type === 'application/pdf') {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
          let fullText = ''
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n'
          }
          setAttachments(prev => [...prev, { id, fileName: file.name, type: 'pdf', content: fullText }])
        } catch (err) {
          console.error("Erreur lecture PDF", err)
        }
      } else {
        try {
          const text = await file.text()
          setAttachments(prev => [...prev, { id, fileName: file.name, type: 'text', content: text }])
        } catch (err) {
          console.error("Erreur lecture fichier", err)
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Fermer le picker au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  useEffect(() => { localStorage.setItem('selectedModel', selectedModel) }, [selectedModel])
  useEffect(() => { localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])

  // Vérifier les modèles en cache au démarrage
  useEffect(() => {
    async function checkCache() {
      const cacheSet = new Set<string>()
      for (const model of AVAILABLE_MODELS) {
        const isCached = await hasModelInCache(model.id)
        if (isCached) cacheSet.add(model.id)
      }
      setCachedModels(cacheSet)
    }
    checkCache()
  }, [])

  // Détection du matériel GPU au chargement
  useEffect(() => {
    async function detectHardware() {
      try {
        if (!navigator.gpu) {
          setHardwareInfo({ gpuName: 'WebGPU non supporté', tier: 'low', estimatedVramMB: 1500, recommendedModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' })
          return
        }

        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          setHardwareInfo({ gpuName: 'Adaptateur GPU générique', tier: 'low', estimatedVramMB: 1500, recommendedModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' })
          return
        }

        let gpuDescription = ''
        try {
          const info = (adapter as any).info || (adapter as any).requestAdapterInfo ? await (adapter as any).requestAdapterInfo() : null
          if (info) gpuDescription = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ')
        } catch { /* ignore */ }

        if (!gpuDescription?.trim()) gpuDescription = 'GPU WebGPU (Nom masqué par le navigateur)'

        const lowerDesc = gpuDescription.toLowerCase()
        let tier: 'low' | 'medium' | 'high' = 'medium'
        let estimatedVramMB = 3000
        let recommendedModelId = 'Qwen3.5-0.8B-q4f16_1-MLC'

        if (
          lowerDesc.includes('rtx') || lowerDesc.includes('gtx') || lowerDesc.includes('geforce') || 
          lowerDesc.includes('radeon') || lowerDesc.includes('rx ') || lowerDesc.includes('apple') || 
          lowerDesc.includes('m1') || lowerDesc.includes('m2') || lowerDesc.includes('m3') || lowerDesc.includes('m4') ||
          lowerDesc.includes('nvidia')
        ) {
          tier = 'high'; estimatedVramMB = 8000; recommendedModelId = 'Qwen3.5-4B-q4f16_1-MLC'
        } else if (lowerDesc.includes('intel') || lowerDesc.includes('uhd') || lowerDesc.includes('iris') || lowerDesc.includes('integrated')) {
          tier = 'low'; estimatedVramMB = 1500; recommendedModelId = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
        }

        if (tier === 'medium' && adapter.limits) {
           const maxBuffer = adapter.limits.maxStorageBufferBindingSize || 0
           if (maxBuffer >= 2000000000) {
              tier = 'high'; estimatedVramMB = 8000; recommendedModelId = 'Qwen3.5-4B-q4f16_1-MLC'
              gpuDescription += ' (Haute capacité détectée)'
           }
        }

        setHardwareInfo({ gpuName: gpuDescription, tier, estimatedVramMB, recommendedModelId })
        if (!localStorage.getItem('selectedModel')) setSelectedModel(recommendedModelId)
      } catch (err) {
        console.warn('Erreur lors de la détection GPU:', err)
      }
    }
    detectHardware()
  }, [])

  const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel)

  const renderModel = (model: ModelInfo) => {
    const isSelected = selectedModel === model.id
    const isCached = cachedModels.has(model.id)
    const isRec = hardwareInfo?.recommendedModelId === model.id
    const vram = model.vramMB >= 1024 ? `${(model.vramMB / 1024).toFixed(1)} Go` : `${model.vramMB} Mo`
    const exceedsVram = hardwareInfo && model.vramMB > hardwareInfo.estimatedVramMB
    
    return (
      <div
        key={model.id}
        onClick={() => {
          if (!isCached) return
          if (model.id !== selectedModel) {
            setSelectedModel(model.id)
          }
          setShowModelPicker(false)
        }}
        className={`w-full px-3 py-2 text-left transition-colors rounded-lg mb-1 ${
          !isCached ? 'opacity-70 cursor-default' : 'cursor-pointer ' + (
            isSelected
              ? dark ? 'bg-blue-600/15 text-blue-300' : 'bg-blue-50 text-blue-600'
              : dark ? 'hover:bg-slate-700/60 text-slate-300' : 'hover:bg-gray-50 text-gray-700'
          )
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isCached ? (
              isSelected ? <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mx-0.5" /> : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0 mx-1" />
            )}
            <span className={`text-[13px] font-medium truncate ${isSelected ? 'font-bold' : ''}`}>{model.name}</span>
            {isRec && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold shrink-0">REC</span>}
          </div>
          {isCached && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setModelToDelete(model)
              }}
              className="text-red-500/70 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors cursor-pointer shrink-0"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        
        <div className={`text-[11px] mt-1.5 flex items-center justify-between ${t.textFaint}`}>
          <div className="flex items-center gap-1.5 pl-5">
            <span>{vram} VRAM</span>
            {exceedsVram && <span className="text-amber-500 font-medium">• Dépasse</span>}
          </div>
          
          {!isCached && (
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setShowModelPicker(false)
                downloadModelBackground(model.id)
              }}
              disabled={bgDownloadingModel !== null}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer shrink-0 ${
                bgDownloadingModel !== null 
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500' 
                  : 'bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              {bgDownloadingModel === model.id ? (
                <><Download size={11} className="animate-pulse" /> {Math.round(bgProgress * 100)}%</>
              ) : (
                <><Download size={11} /> {model.size}</>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  const initializeEngine = async (modelIdToLoad: string = selectedModel) => {
    if (loading) return engine
    if (engine && loadedModel === modelIdToLoad) return engine

    setLoading(true)
    let webLlmEngine = engine
    try {
      if (!webLlmEngine) {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        webLlmEngine = new WebWorkerMLCEngine(worker)
        webLlmEngine.setInitProgressCallback((report) => {
          setProgress(report.progress)
        })
      }
      await webLlmEngine.reload(modelIdToLoad) 
      setEngine(webLlmEngine)
      setLoadedModel(modelIdToLoad)
    } catch (error) {
      console.error('Failed to initialize engine', error)
    }
    setLoading(false)
    
    // Update cache status after loading
    hasModelInCache(modelIdToLoad).then(cached => {
      if (cached) {
        setCachedModels(prev => {
          const next = new Set(prev)
          next.add(modelIdToLoad)
          return next
        })
      }
    })

    return webLlmEngine
  }

  const downloadModelBackground = async (modelId: string) => {
    if (bgDownloadingModel) return
    setBgDownloadingModel(modelId)
    setBgProgress(0)
    setBgProgressText('Démarrage du téléchargement...')
    
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      const dlEngine = new WebWorkerMLCEngine(worker)
      dlEngine.setInitProgressCallback((report) => {
        setBgProgress(report.progress)
        setBgProgressText(report.text)
      })
      await dlEngine.reload(modelId)
      await dlEngine.unload()
      worker.terminate()
      
      setCachedModels(prev => {
        const next = new Set(prev)
        next.add(modelId)
        return next
      })
    } catch (err) {
      console.error('Erreur de téléchargement', err)
    }
    setBgDownloadingModel(null)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || generating || loading) return
    
    const hasImages = attachments.some(a => a.type === 'image')
    const isVisionModel = selectedModel.toLowerCase().includes('vision') || selectedModel.toLowerCase().includes('vl')
    
    if (hasImages && !isVisionModel) {
      alert("Ce modèle ne supporte pas les images. Veuillez sélectionner un modèle Vision (ex: Phi-3.5 Vision).")
      return
    }

    const userMessage = { role: 'user', content: input, attachedFiles: attachments }
    setMessages(prev => [...prev, userMessage as any])
    setInput('')
    setAttachments([])
    setGenerating(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    let activeEngine = engine
    if (!activeEngine || loadedModel !== selectedModel) {
      activeEngine = await initializeEngine(selectedModel)
      if (!activeEngine) {
        setGenerating(false)
        return
      }
    }

    try {
      const allMessages = [...messages, userMessage] as { role: string, content: ChatMessageContent, attachedFiles?: Attachment[] }[]
      const apiMessages = allMessages.map(msg => {
        const attachedFiles = msg.attachedFiles
        if (msg.role !== 'user' || !attachedFiles || attachedFiles.length === 0) {
          return { role: msg.role, content: msg.content }
        }

        let finalContent: any = msg.content
        const textAtts = attachedFiles.filter((a: Attachment) => a.type === 'text' || a.type === 'pdf')
        
        if (textAtts.length > 0) {
          const attText = textAtts.map((a: Attachment) => `[Fichier joint: ${a.fileName}]\n${a.content}`).join('\n\n')
          finalContent = `${attText}\n\n${msg.content}`
        }

        const imgAtts = attachedFiles.filter((a: Attachment) => a.type === 'image')
        if (imgAtts.length > 0) {
          const contentArray: any[] = []
          if (finalContent) contentArray.push({ type: 'text', text: finalContent as string })
          
          imgAtts.forEach((a: Attachment) => {
            contentArray.push({ type: 'image_url', image_url: { url: a.content } })
          })
          finalContent = contentArray
        }
        
        return { role: 'user', content: finalContent }
      })

      const completion = await activeEngine.chat.completions.create({ stream: true, messages: apiMessages as any })
      let fullResponse = ''
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        fullResponse += delta
        setMessages(prev => { const n = [...prev]; n[n.length - 1].content = fullResponse; return n })
      }
    } catch (error) {
      console.error(error)
      setMessages(prev => { const n = [...prev]; n[n.length - 1].content = "Erreur de génération."; return n })
    }
    setGenerating(false)
  }

  const stopGeneration = () => {
    if (engine && generating) {
      engine.interruptGenerate()
      setGenerating(false)
    }
  }


  const isDownloading = bgDownloadingModel !== null
  let parsedProgressText = ''
  if (isDownloading) {
    const fetchedMatch = bgProgressText.match(/([\d.]+\s*[M|G]B)\s*fetched/i)
    const pctMatch = bgProgressText.match(/([\d.]+)%\s*completed/i)
    if (fetchedMatch && pctMatch) {
      const fetchedStr = fetchedMatch[1]
      const pct = parseFloat(pctMatch[1])
      const fetchedVal = parseFloat(fetchedStr)
      const unit = fetchedStr.replace(/[\d.\s]/g, '')
      const total = pct > 0 ? Math.round((fetchedVal * 100) / pct) : 0
      parsedProgressText = `${fetchedStr} / ${total}${unit}`
    } else {
      parsedProgressText = 'Démarrage du téléchargement...'
    }
  }

  // ─── Palette dynamique ───
  const t = {
    bg: dark ? 'bg-slate-900' : 'bg-white',
    text: dark ? 'text-slate-100' : 'text-gray-800',
    textMuted: dark ? 'text-slate-400' : 'text-gray-500',
    textFaint: dark ? 'text-slate-500' : 'text-gray-400',
    headerBg: dark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200',
    footerBg: dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200',
    cardBg: dark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-gray-50 border-gray-200',
    inputBg: dark ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200',
    inputText: dark ? 'text-slate-200' : 'text-gray-800',
    selectBg: dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-gray-100 border-gray-200 text-gray-800',
    userBubble: dark ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-800',
    aiBubble: 'bg-transparent text-inherit',
    loadingCard: dark ? 'bg-slate-800/60 border-slate-700/40' : 'bg-gray-50 border-gray-200',
    warnBg: dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700',
    warnIcon: dark ? 'text-amber-400' : 'text-amber-500',
    progressTrack: dark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-gray-200 border-gray-300/50',
    vramBadge: dark ? 'bg-blue-900/40 text-blue-300 border-blue-700/30' : 'bg-blue-50 text-blue-600 border-blue-200',
    themeBtn: dark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600',
    sendBtn: dark ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700' : 'bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300',
    glowPulse: dark ? 'bg-blue-500/20' : 'bg-blue-500/10',
    cachedGlow: dark ? 'bg-emerald-500/20' : 'bg-emerald-500/10',
    dotColor: dark ? 'bg-slate-400' : 'bg-gray-400',
  }

  return (
    <div className={`flex flex-col h-screen ${t.bg} ${t.text} font-sans transition-colors duration-300 relative`}>
      {/* ─── Sidebar Overlay ─── */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className={`fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col shadow-2xl border-r ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}
            >
              <div className={`p-4 border-b flex items-center justify-between ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
                <h2 className="font-semibold text-lg">Historique</h2>
                <button onClick={() => setShowSidebar(false)} className={`cursor-pointer p-1.5 rounded-full ${dark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
                  <X size={16} />
                </button>
              </div>
              <div className="p-3">
                <button onClick={startNewChat} className={`cursor-pointer w-full flex items-center gap-2 justify-center py-2.5 rounded-lg border-2 border-dashed ${dark ? 'border-slate-700 hover:border-blue-500 hover:bg-blue-500/10 text-slate-300' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700'} transition-all`}>
                  <Plus size={16} /> Nouvelle discussion
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatHistory.length === 0 ? (
                  <p className={`text-center text-sm mt-10 ${t.textFaint}`}>Aucun historique</p>
                ) : (
                  chatHistory.map(chat => (
                    <div key={chat.id} onClick={() => loadChat(chat)} className={`group relative w-full flex flex-col text-left p-3 rounded-lg cursor-pointer border transition-colors ${currentChatId === chat.id ? (dark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200') : (dark ? 'bg-slate-800/50 border-slate-800 hover:border-slate-700' : 'bg-gray-50 border-gray-100 hover:border-gray-300')}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare size={13} className={`shrink-0 ${currentChatId === chat.id ? 'text-blue-500' : t.textFaint}`} />
                          <span className={`text-sm font-medium truncate ${currentChatId === chat.id ? 'text-blue-600 dark:text-blue-400' : ''}`}>{chat.title}</span>
                        </div>
                        <button onClick={(e) => deleteChat(e, chat.id)} className={`cursor-pointer opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 transition-all ${t.textFaint}`} title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className={`flex items-center justify-between mt-2 text-[10px] ${t.textFaint}`}>
                        <span className="truncate max-w-[120px]">{AVAILABLE_MODELS.find(m => m.id === chat.modelId)?.name || 'Modèle inconnu'}</span>
                        <span>{new Date(chat.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Header ─── */}
      <header className={`px-4 py-3 border-b ${t.headerBg} backdrop-blur-md sticky top-0 z-10 flex items-center justify-between transition-colors duration-300 relative`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSidebar(true)} className={`cursor-pointer p-1.5 rounded-md ${dark ? 'hover:bg-slate-800' : 'hover:bg-gray-200'} transition-colors`}>
            <Menu size={18} />
          </button>
        </div>

        {isDownloading && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-48 max-w-sm w-full px-8 z-0">
            <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1.5 ${dark ? 'bg-slate-700/60' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.round(bgProgress * 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium truncate w-full text-center ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              <span className="font-bold">{AVAILABLE_MODELS.find(m => m.id === bgDownloadingModel)?.name}</span> - {parsedProgressText || `${Math.round(bgProgress * 100)}%`}
            </span>
          </div>
        )}

        <button onClick={() => setDark(!dark)} className={`cursor-pointer p-1.5 rounded-full ${t.themeBtn} border transition-all duration-300 relative z-10`} title={dark ? 'Mode clair' : 'Mode sombre'}>
          <motion.div initial={false} animate={{ rotate: dark ? 180 : 0 }} transition={{ duration: 0.4, ease: 'easeInOut' }}>
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </motion.div>
        </button>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Messages */}
        {messages.map((msg, idx) => {
          if (loading && idx === messages.length - 1 && msg.role === 'assistant' && msg.content === '') {
            return null;
          }
          // Parsing pour les modèles "reasoning" (ex: Qwen qui utilise <think>)
          let hasThink = false;
          let thinkContent = '';
          let isClosed = false;
          let restContent = Array.isArray(msg.content) 
            ? msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
            : msg.content;
          
          if (msg.role === 'assistant' && typeof msg.content === 'string') {
            const thinkMatch = msg.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
            if (thinkMatch) {
              hasThink = true;
              thinkContent = thinkMatch[1].trim();
              isClosed = msg.content.includes('</think>');
              restContent = msg.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
            }
          }

          return (
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              key={idx} 
              className={`group flex flex-col mb-4 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`flex items-center gap-1.5 text-[13px] font-medium ${t.textFaint} mb-1 pl-1`}>
                  <span>{selectedModelData?.name || 'Assistant'} &gt;</span>
                </div>
              )}
              
              <div className={`max-w-[85%] rounded-2xl ${
                msg.role === 'user' 
                  ? `${t.userBubble} px-4 py-3 shadow-sm` 
                  : `${t.aiBubble} pr-4 py-2`
              } transition-colors duration-300`}>
                
                {hasThink && (
                  <details className="mb-3 group" open={!isClosed}>
                    <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <Brain size={12} className={!isClosed ? 'animate-pulse text-blue-500' : ''} />
                      {isClosed ? 'Processus de réflexion' : 'Réflexion en cours...'}
                    </summary>
                    <div className="mt-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {thinkContent}
                    </div>
                  </details>
                )}
                
                {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.attachedFiles.map((att, i) => (
                      <div key={i}>
                        {att.type === 'image' ? (
                          <img src={att.content} alt="attachment" className="max-w-64 max-h-64 rounded-lg object-contain shadow-sm" />
                        ) : (
                          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] border shadow-sm ${dark ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <span className="truncate max-w-32 font-medium">📄 {att.fileName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {restContent && (
                  <div className={`text-[15px] leading-relaxed break-words space-y-4 ${msg.role === 'user' ? '' : 'markdown-body'}`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{restContent}</p>
                    ) : (
                      <ReactMarkdown
                        components={{
                          code: CodeBlock,
                          p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                          li: ({children}) => <li>{children}</li>,
                          h1: ({children}) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
                          h2: ({children}) => <h2 className="text-lg font-bold mb-3 mt-4">{children}</h2>,
                          h3: ({children}) => <h3 className="text-md font-bold mb-2 mt-3">{children}</h3>,
                          a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{children}</a>,
                          blockquote: ({children}) => <blockquote className="border-l-4 border-slate-400 pl-4 py-1 italic opacity-80 my-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-r-lg">{children}</blockquote>,
                          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {restContent}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
              </div>

              {/* Action bar for user messages */}
              {msg.role === 'user' && (
                <div className={`flex items-center gap-1.5 mt-1.5 ${t.textMuted} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
                   <button onClick={() => rollbackAndEdit(idx)} className="cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Modifier et renvoyer">
                      <RotateCcw size={14} />
                   </button>
                   <button onClick={() => navigator.clipboard.writeText(restContent as string)} className="cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Copier">
                      <Copy size={14} />
                   </button>
                </div>
              )}

              {/* Action bar for assistant messages */}
              {msg.role === 'assistant' && msg.content && (
                <div className={`flex items-center gap-1.5 mt-1 pl-1 ${t.textMuted} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
                   <button onClick={() => navigator.clipboard.writeText(restContent)} className="cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Copier">
                      <Copy size={14} />
                   </button>
                </div>
              )}
            </motion.div>
          )
        })}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start pl-3 py-2">
            <div className="flex items-center gap-2.5">
              <Loader2 size={16} strokeWidth={2.5} className="animate-spin text-slate-400 dark:text-slate-500" />
              <span className="text-[13px] font-medium text-blue-500/90 dark:text-blue-400/90 tracking-wide">
                Loading model {Math.round(progress * 100)}%
              </span>
            </div>
          </motion.div>
        )}
        {generating && !loading && messages[messages.length - 1]?.content === '' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className={`${t.aiBubble} rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center shadow-sm transition-colors duration-300`}>
              <span className={`w-1.5 h-1.5 rounded-full ${t.dotColor} animate-bounce`} style={{ animationDelay: '0ms' }} />
              <span className={`w-1.5 h-1.5 rounded-full ${t.dotColor} animate-bounce`} style={{ animationDelay: '150ms' }} />
              <span className={`w-1.5 h-1.5 rounded-full ${t.dotColor} animate-bounce`} style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* ─── Footer ─── */}
      <footer className={`px-3 pt-2 pb-3 ${t.footerBg} border-t transition-colors duration-300`}>
        {/* Model chip row */}
        <div className="flex items-center justify-between mb-2 px-1 relative w-full" ref={modelPickerRef}>
          <div>
            <button
              type="button"
              onClick={() => { if (!generating && !loading) setShowModelPicker(!showModelPicker) }}
              disabled={generating || loading}
              className={`cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 disabled:opacity-50 ${
                dark
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Settings size={11} className="shrink-0" />
              <span className="max-w-[140px] truncate">{selectedModelData?.name || 'Modèle'}</span>
              {engine && <span className="text-[9px] font-bold text-emerald-500 uppercase">On</span>}
              <ChevronDown size={11} className={`transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown popup */}
            {showModelPicker && (
              <div className={`absolute bottom-full left-0 right-0 mb-1.5 w-full rounded-xl border shadow-xl z-50 overflow-hidden backdrop-blur-lg ${
                dark ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-gray-200'
              }`}>
                {hardwareInfo && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 border-b text-[10px] ${t.textFaint} ${
                    dark ? 'border-slate-700' : 'border-gray-100'
                  }`}>
                    <Cpu size={10} className="text-blue-500 shrink-0" />
                    <span>{(hardwareInfo.estimatedVramMB / 1024).toFixed(1)} Go VRAM</span>
                    {diskSpace !== null && (
                      <span className="ml-auto shrink-0 font-medium">Disque libre : {(diskSpace / 1024 / 1024 / 1024).toFixed(1)} Go</span>
                    )}
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto p-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase px-1">Petits modèles</div>
                      {AVAILABLE_MODELS.slice(0, 4).map(renderModel)}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase px-1">Modèles moyens</div>
                      {AVAILABLE_MODELS.slice(4, 8).map(renderModel)}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase px-1">Grands modèles</div>
                      {AVAILABLE_MODELS.slice(8, 12).map(renderModel)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 mb-2">
            {attachments.map(att => (
              <div key={att.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] border ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                {att.type === 'image' ? (
                  <img src={att.content} alt={att.fileName} className="w-5 h-5 object-cover rounded-sm" />
                ) : (
                  <span className="truncate max-w-24 font-medium">{att.fileName}</span>
                )}
                <button type="button" onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} className="text-gray-400 hover:text-red-500 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <form onSubmit={sendMessage} className="relative flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,.txt,.md,.json,.csv,.pdf,.html,.js,.ts,.tsx,.css" />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || generating}
            className={`cursor-pointer p-2.5 rounded-full border transition-all duration-300 shrink-0 ${dark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-600'} disabled:opacity-50`}
          >
            <Plus size={16} />
          </button>
          
          <div className="relative flex-1">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={loading || generating}
              placeholder={loading ? "Chargement en cours..." : "Écrire un message..."}
              className={`w-full ${t.inputBg} ${t.inputText} rounded-full pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 transition-all duration-300 border`} />
            {generating ? (
              <button type="button" onClick={stopGeneration}
                className={`cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2 p-2 ${dark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-full transition-all duration-200 flex items-center justify-center`}>
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
              </button>
            ) : (
              <button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)}
                className={`cursor-pointer disabled:cursor-not-allowed absolute right-1.5 top-1/2 -translate-y-1/2 p-2 ${t.sendBtn} rounded-full transition-all duration-200`}>
                <ArrowUp size={15} strokeWidth={2.5} className="text-white" />
              </button>
            )}
          </div>
        </form>
      </footer>
      {/* ─── Popup de suppression ─── */}
      {modelToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border ${dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-800'}`}>
            <h3 className="text-lg font-bold mb-2">Confirmer la suppression</h3>
            <p className={`text-sm mb-5 ${t.textMuted}`}>
              Êtes-vous sûr de vouloir supprimer le modèle <span className="font-semibold">{modelToDelete.name}</span> ? Cette action libérera de l'espace sur votre disque dur.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setModelToDelete(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${dark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  const id = modelToDelete.id
                  setModelToDelete(null)
                  try {
                    await deleteModelAllInfoInCache(id)
                    setCachedModels(prev => {
                      const next = new Set(prev)
                      next.delete(id)
                      return next
                    })
                    if (engine && loadedModel === id) {
                      window.location.reload()
                    }
                  } catch (e) {
                    console.error('Erreur lors de la suppression', e)
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
