import { useState } from 'react'
import client from '../api/client'
import { Icon } from '../components/Icon'

const FREQUENT_QUESTIONS = [
  'What documents do I need for income certificate?',
  'How long does processing take?',
  'Is there a fee for application?',
  'What happens if I submit twice?',
  'Can I appeal a rejection?',
]

export default function AskQuestion() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleAsk(event, customQ) {
    if (event) event.preventDefault()
    const q = customQ || question
    setError(null)
    if (!q.trim()) return

    setLoading(true)
    try {
      const response = await client.post('/api/ask', { question: q })
      setResult(response.data)
      if (customQ) setQuestion(customQ)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not process question with policy assistant.')
    } finally {
      setLoading(false)
    }
  }

  function confidenceLabel(relevance) {
    if (relevance > 0.3) return 'High match'
    if (relevance < 0.1) return 'Low match'
    return 'Moderate match'
  }

  return (
    <div>
      <div className="page-header">
        <h2>Regulation & Policy Assistant</h2>
        <p>
          Instant answers grounded in official government gazette rules, statutory service timelines, and eligibility guidelines.
        </p>
      </div>

      <form onSubmit={(e) => handleAsk(e)} className="card">
        <div className="field">
          <label htmlFor="question">What do you want to know?</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              id="question"
              type="text"
              placeholder="e.g. What documents do I need for income certificate?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Searching\u2026' : 'Ask'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
            Frequently Asked:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {FREQUENT_QUESTIONS.map((fq) => (
              <button
                key={fq}
                type="button"
                className="badge badge-neutral"
                style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12, border: '1px solid var(--color-border)' }}
                onClick={(e) => handleAsk(e, fq)}
              >
                {fq}
              </button>
            ))}
          </div>
        </div>
      </form>

      {error && (
        <div className="status-banner danger flex items-center gap-2">
          <Icon name="alert-circle" size={16} className="text-red-600 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.generated_answer ? (
            <div className="status-banner success mb-4 flex items-start gap-2">
              <Icon name="check-circle" size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Answer</strong>
                <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{result.generated_answer}</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 16 }}>
              No generated answer available right now (local model not running) — showing the matched regulation passage directly.
            </p>
          )}

          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Matched Regulation Passages:</div>
          {result.matches.map((match) => (
            <div
              key={match.id}
              className="card"
              style={{
                borderLeft: '4px solid var(--color-primary)',
                background: 'var(--color-surface)',
                marginBottom: 12,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="badge badge-info">{confidenceLabel(match.relevance)}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                  section: {match.id} (rel: {match.relevance})
                </span>
              </div>
              <p style={{ margin: '4px 0 0', lineHeight: 1.6, color: 'var(--color-ink)' }}>{match.text}</p>
            </div>
          ))}

          {result.matches[0]?.relevance < 0.1 && (
            <div className="status-banner warning flex items-center gap-2">
              <Icon name="alert-triangle" size={16} className="text-amber-600 shrink-0" />
              <div>
                None of the regulation passages matched this well — try rephrasing, or this may not be covered yet.
              </div>
            </div>
          )}

          {/* Explicit Legal Disclaimer */}
          <div className="p-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-ink-muted)] flex items-start gap-2">
            <Icon name="shield" size={16} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <strong>Civic Advisory:</strong> Information provided is for citizen guidance only, grounded in indexed gazette notifications. Statutory decisions and official issuances remain under the exclusive authority of the Competent Revenue Officer.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
