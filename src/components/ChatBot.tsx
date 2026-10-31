import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { BOT_PROFILES, answer, type BotReply, type Page } from '../lib/chatbot'
import { todayIST } from '../lib/date'
import { useStore } from '../lib/store'
import { cx } from './ui'

type Msg = { from: 'bot' | 'me'; reply: BotReply }

// Renders **bold** inside a line of bot text.
function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}

const ACCENT = { hr: 'bg-brand', manager: 'bg-info', employee: 'bg-ok' } as const

export function ChatBot({ setPage }: { setPage: (p: Page) => void }) {
  const { session, data } = useStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const role = session?.role ?? 'employee'
  const profile = BOT_PROFILES[role]
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', reply: { text: profile.intro } }])
  const endRef = useRef<HTMLDivElement>(null)

  // A different user signing in gets a fresh conversation.
  useEffect(() => {
    setMsgs([{ from: 'bot', reply: { text: BOT_PROFILES[role].intro } }])
  }, [session?.employeeId, role])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, typing, open])

  if (!session) return null

  const ask = (q: string) => {
    const text = q.trim()
    if (!text || typing) return
    setInput('')
    setMsgs((m) => [...m, { from: 'me', reply: { text } }])
    setTyping(true)
    setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', reply: answer(text, { session, data, today: todayIST() }) }])
      setTyping(false)
    }, 450)
  }

  return (
    <div className="no-print">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cx('fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105 cursor-pointer', ACCENT[role])}
        >
          <MessageCircle size={18} /> {profile.title}
        </button>
      )}
      {open && (
        <div className="fixed right-4 bottom-4 z-40 flex h-[min(600px,calc(100vh-2rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          <div className={cx('flex items-center gap-3 px-4 py-3.5 text-white', ACCENT[role])}>
            <span className="grid size-9 place-items-center rounded-xl bg-white/20">
              <Bot size={19} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{profile.title}</p>
              <p className="text-[11px] text-white/80">Answers from live HRMS data</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 cursor-pointer" aria-label="Close chat">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={cx('flex', m.from === 'me' && 'justify-end')}>
                <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed', m.from === 'me' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-white')}>
                  {m.reply.text.split('\n').map((line, j) => (
                    <p key={j} className={line.startsWith('•') ? 'pl-1' : ''}>
                      <RichLine text={line} />
                    </p>
                  ))}
                  {m.reply.actions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.reply.actions.map((a) => (
                        <button key={a.label} onClick={() => {
                          setPage(a.page)
                          if (window.innerWidth < 640) setOpen(false)
                        }} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-soft cursor-pointer">
                          {a.label} →
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex">
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-line bg-white px-3 pt-2.5 pb-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {profile.suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-line cursor-pointer">
                  <Sparkles size={11} /> {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                className="h-10 flex-1 rounded-xl border border-line px-3 text-sm focus:border-ink focus:outline-none"
                aria-label="Message"
              />
              <button type="submit" className={cx('grid size-10 place-items-center rounded-xl text-white disabled:opacity-50 cursor-pointer', ACCENT[role])} disabled={!input.trim()} aria-label="Send">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
