import { useState } from 'react'
import client from '../api/client'

export default function AskQuestion() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleAsk(event) {
    event.preventDefault()
    setError(null)
    if (!question.trim()) return

    setLoading(true)
    try {
      const response = await client.post('/api/ask', { question })
      setResult(response.data)
    } catch (err) {
      setError('Could not reach SevaSetu\u2019s backend.')
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
      <h2>Ask a Question</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>
        Answers come from the actual regulation text, not a generated guess — if nothing matches well,
        you'll see a low relevance score rather than a confident-sounding wrong answer.
      </p>

      <form onSubmit={handleAsk} className="card">
        <div className="field">
          <label htmlFor="question">What do you want to know?</label>
          <input
            id="question"
            type="text"
            placeholder="e.g. How long does processing take?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>{loading ? 'Searching\u2026' : 'Ask'}</button>
      </form>

      {error && <div className="status-banner danger">{error}</div>}

      {result && (
        <>
          {result.generated_answer ? (
            <div className="status-banner success">
              <strong>Answer</strong>
              <p style={{ margin: '4px 0 0' }}>{result.generated_answer}</p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
              No generated answer available right now (local model not running) — showing the matched regulation passage directly.
            </p>
          )}

          {result.matches.map((match) => (
            <div className="status-banner" style={{ background: '#eaf3f2', color: 'var(--color-primary)' }} key={match.id}>
              <strong>{confidenceLabel(match.relevance)}</strong>
              <p style={{ margin: '4px 0 0' }}>{match.text}</p>
            </div>
          ))}

          {result.matches[0]?.relevance < 0.1 && (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
              None of the regulation passages matched this well — try rephrasing, or this may not be covered yet.
            </p>
          )}
        </>
      )}
    </div>
  )
}
