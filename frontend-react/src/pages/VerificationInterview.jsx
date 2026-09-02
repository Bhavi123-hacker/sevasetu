import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import client, { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from '../components/Icon'

/**
 * Robust helper to extract grounded question text across all API schemas.
 * If backend text is missing, generates grounded question from citizen's application metadata.
 */
export function extractQuestionText(questionObj, appDetail = null) {
  if (!questionObj) return ''
  if (typeof questionObj === 'string') return questionObj.trim()

  const direct =
    questionObj.question_text ||
    questionObj.question ||
    questionObj.text ||
    questionObj.prompt ||
    questionObj.title ||
    questionObj.content ||
    questionObj.q_text

  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim()
  }

  // Grounded fallback generation matching backend generate_interview_questions
  const category = (questionObj.category || questionObj.expected_field || '').toUpperCase()
  const citizenName = appDetail?.citizen_name || ''
  const serviceType = (appDetail?.service_type || '').replace(/_/g, ' ')

  if (category === 'IDENTITY' || category === 'NAME') {
    return citizenName
      ? `Please state your full legal name as it appears on your identity documents.`
      : `Please state your full legal name.`
  }
  if (category === 'DATE_OF_BIRTH' || category === 'DOB') {
    return `What is your date of birth?`
  }
  if (category === 'ADDRESS' || category === 'RESIDENCE') {
    return `What is your current residential address or district?`
  }
  if (category === 'SERVICE_PURPOSE' || category === 'PURPOSE') {
    return serviceType
      ? `What is the primary purpose of your ${serviceType} application?`
      : `What is the primary purpose of your application?`
  }
  if (category === 'DOCUMENT_INFORMATION' || category === 'DOCUMENTS') {
    return `Which proof documents have you prepared for this application?`
  }

  return ''
}

export function extractQuestionCategory(questionObj) {
  if (!questionObj) return 'GENERAL'
  return (
    questionObj.category ||
    questionObj.expected_field ||
    questionObj.type ||
    'GENERAL'
  ).toUpperCase()
}

export default function VerificationInterview() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const appId = searchParams.get('application_id') || searchParams.get('app_id') || searchParams.get('id')
  const token = searchParams.get('token')

  // Screen phases: 'CHECKING' | 'INELIGIBLE' | 'READY_TO_START' | 'IN_SESSION' | 'COMPLETED'
  const [phase, setPhase] = useState('CHECKING')
  const [appDetail, setAppDetail] = useState(null)
  const [ineligibleReason, setIneligibleReason] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Session Question & Answer State
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [answering, setAnswering] = useState(false)
  const [lastAnswerResult, setLastAnswerResult] = useState(null)
  const [answersLedger, setAnswersLedger] = useState([])
  const [summary, setSummary] = useState(null)

  // Real Camera & Microphone Media State
  const [cameraState, setCameraState] = useState('off') // 'active' | 'denied' | 'not_found' | 'in_use' | 'error' | 'off'
  const [micState, setMicState] = useState('off') // 'active' | 'denied' | 'not_found' | 'in_use' | 'error' | 'off'
  const [mediaErrorMessage, setMediaErrorMessage] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [useTypedFallback, setUseTypedFallback] = useState(false)

  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const recognitionRef = useRef(null)

  // Attach active MediaStream to video element
  const syncVideoStream = useCallback(() => {
    if (videoRef.current && mediaStreamRef.current && cameraState === 'active') {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current
      }
      videoRef.current.play().catch((err) => {
        console.warn('Video element play warning:', err)
      })
    }
  }, [cameraState])

  // Sync stream whenever video element, camera state, or session phase changes
  useEffect(() => {
    syncVideoStream()
  }, [syncVideoStream, phase, currentQIndex, cameraState])

  // 1. Initial Application Status Verification
  useEffect(() => {
    async function verifyApplicationEligibility() {
      if (!appId) {
        setIneligibleReason(
          'No application specified. Please access the verification interview from your application status tracking page or notification.'
        )
        setPhase('INELIGIBLE')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await client.get(`/api/applications/${appId}`, {
          params: token ? { token } : {},
          headers: token ? { 'X-Tracking-Token': token } : {},
        })
        const app = res.data
        setAppDetail(app)

        if (app.status === 'INTERVIEW_ELIGIBLE' || app.status === 'INTERVIEW_IN_PROGRESS') {
          setPhase('READY_TO_START')
        } else if (app.status === 'INTERVIEW_COMPLETED' || app.status === 'FINAL_OFFICER_REVIEW') {
          setPhase('COMPLETED')
          setSummary({
            overall_consistency: app.interview_consistency || 'CONSISTENT',
            summary_notes: 'Interview previously completed and recorded for final officer review.',
            disclaimer: 'AI-assisted factual cross-consistency with submitted records.',
          })
        } else {
          setIneligibleReason(
            `Verification interview is not available for status: ${app.status}. Documents must first complete automated pre-verification and authorized officer review.`
          )
          setPhase('INELIGIBLE')
        }
      } catch (err) {
        console.error('Eligibility check failed:', err)
        const detail = err.response?.data?.detail
        if (err.response?.status === 404) {
          setIneligibleReason('No application found matching the provided reference ID.')
          setPhase('INELIGIBLE')
        } else if (err.response?.status === 400 || err.response?.status === 403) {
          setIneligibleReason(detail || 'Verification interview is not accessible for this application.')
          setPhase('INELIGIBLE')
        } else {
          setError(detail || 'Could not connect to SevaSetu service to verify interview eligibility.')
        }
      } finally {
        setLoading(false)
      }
    }

    verifyApplicationEligibility()
  }, [appId, token])

  // Check SpeechRecognition capability on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      setUseTypedFallback(true)
    }
  }, [])

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      stopAllMedia()
    }
  }, [])

  const stopAllMedia = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setCameraState('off')
    setMicState('off')
    setIsListening(false)
  }, [])

  // Request camera and microphone media with graceful fallback
  const requestMediaPermissions = async () => {
    setMediaErrorMessage(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('not_found')
        setMicState('not_found')
        setMediaErrorMessage('Camera/Microphone API is not supported in this browser.')
        return false
      }

      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        })
      } catch (comboErr) {
        console.warn('Combined getUserMedia failed, trying video-only:', comboErr)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch (vidErr) {
          console.warn('Video-only failed, trying audio-only:', vidErr)
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          } catch (audErr) {
            throw comboErr
          }
        }
      }

      if (!stream) {
        throw new Error('No media stream returned.')
      }

      mediaStreamRef.current = stream

      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()
      const hasVideo = videoTracks.length > 0 && videoTracks.some((t) => t.readyState === 'live' && t.enabled)
      const hasAudio = audioTracks.length > 0 && audioTracks.some((t) => t.readyState === 'live' && t.enabled)

      setCameraState(hasVideo ? 'active' : 'not_found')
      setMicState(hasAudio ? 'active' : 'not_found')

      if (videoRef.current && hasVideo) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.warn('video.play() caught:', playErr)
        }
      }
      return true
    } catch (err) {
      console.warn('Media permission issue:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('denied')
        setMicState('denied')
        setMediaErrorMessage('Camera access is blocked. Please allow permissions in your browser address bar, or continue with typed answers.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('not_found')
        setMicState('not_found')
        setMediaErrorMessage('No camera or microphone found on this device. You can type your responses below.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraState('in_use')
        setMicState('in_use')
        setMediaErrorMessage('Camera or microphone is in use by another application. You can type your responses below.')
      } else {
        setCameraState('error')
        setMicState('error')
        setMediaErrorMessage('Unable to initialize media device. You may type your responses below.')
      }
      return false
    }
  }

  // Start Interview Session Trigger
  const handleStartInterviewSession = async () => {
    setLoading(true)
    setError(null)

    // Attempt to acquire media
    await requestMediaPermissions()

    try {
      const res = await api.startInterview({
        application_id: appId,
        tracking_token: token || undefined,
      })
      const rawSession = res.data

      const rawQuestions = rawSession.questions || []
      const normalizedQuestions = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id || q.question_id || `q-${idx + 1}`,
        order_num: q.order_num || idx + 1,
        category: extractQuestionCategory(q),
        question_text: extractQuestionText(q, appDetail),
      }))

      setSession({
        ...rawSession,
        questions: normalizedQuestions,
      })
      setCurrentQIndex(0)
      setAnswersLedger([])
      setLastAnswerResult(null)
      setTranscript('')
      setPhase('IN_SESSION')
    } catch (err) {
      console.error('Failed to start interview session:', err)
      const detail = err.response?.data?.detail
      if (err.response?.status === 400 || err.response?.status === 403) {
        setIneligibleReason(detail || 'Verification interview is not available yet.')
        setPhase('INELIGIBLE')
      } else {
        setError(detail || 'AI interview service is temporarily unavailable. Please retry.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Voice Speech Recognition Toggle
  const toggleVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice speech recognition is not supported in this browser. Please type your response below.')
      setUseTypedFallback(true)
      return
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-IN'

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        let currentText = ''
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript
        }
        setTranscript(currentText)
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
    }
  }

  // Submit Question Answer for Grounded Evaluation
  const handleSubmitAnswer = async () => {
    if (!transcript.trim() || !session) return
    const currentQ = session.questions?.[currentQIndex]
    if (!currentQ) return
    const qText = extractQuestionText(currentQ, appDetail)

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      setIsListening(false)
    }

    setAnswering(true)
    setError(null)
    try {
      const sessionId = session.session_id || session.id
      const res = await api.answerInterview(sessionId, {
        question_id: currentQ.id || currentQ.question_id || `q-${currentQIndex + 1}`,
        transcript_text: transcript.trim(),
      })

      const answerResult = res.data
      setLastAnswerResult(answerResult)
      setAnswersLedger((prev) => [...prev, { ...currentQ, question_text: qText, answerResult }])
    } catch (err) {
      console.error('Failed to evaluate answer:', err)
      setError(err.response?.data?.detail || 'Failed to submit answer. Please retry.')
    } finally {
      setAnswering(false)
    }
  }

  // Proceed to Next Question or Complete Interview
  const handleProceedNext = async () => {
    if (!session) return
    setError(null)

    if (currentQIndex + 1 < (session.questions?.length || 0)) {
      setLastAnswerResult(null)
      setTranscript('')
      setCurrentQIndex((prev) => prev + 1)
    } else {
      // Complete interview on backend
      setLoading(true)
      try {
        const sessionId = session.session_id || session.id
        const compRes = await api.completeInterview(sessionId)
        setSummary(compRes.data)
        setPhase('COMPLETED')
        stopAllMedia()
      } catch (err) {
        console.error('Failed to complete interview:', err)
        setError(err.response?.data?.detail || 'Failed to record interview completion. Please check connection and retry.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Civic Ethics Notice */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="mic" size={20} className="text-teal-600 dark:text-teal-400" />
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                AI Verification Interview
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Interactive factual cross-consistency check between your spoken/text statements and uploaded documents.
            </p>
          </div>
          <span className="badge badge-info text-xs">Factual Consistency Only</span>
        </div>

        {/* Civic Ethics Invariant Disclaimer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
          <Icon name="shield" size={16} className="text-teal-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-800 dark:text-slate-200">Ethical AI Guardrails:</strong> This session evaluates factual consistency against submitted documents.
            <strong> No lie detection, emotion analysis, or psychological scoring</strong> is performed. Audio and video feeds are optional, processed locally in real time, and raw media is discarded by default.
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="status-banner danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" size={16} />
            <span><strong>Error:</strong> {error}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* PHASE 1: Loading Initial Status */}
      {phase === 'CHECKING' && (
        <div className="card p-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Verifying application eligibility and loading session records...
          </p>
        </div>
      )}

      {/* PHASE 2: Ineligible / Direct URL Blocked */}
      {phase === 'INELIGIBLE' && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-full flex items-center justify-center mx-auto">
            <Icon name="lock" size={24} />
          </div>
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
            Verification Interview Is Not Available Yet
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {ineligibleReason ||
              'Your documents must first complete automated pre-verification and authorized officer document review before the interview becomes available.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(appId ? `/status?id=${appId}${token ? `&token=${token}` : ''}` : '/status')}
            >
              <Icon name="search" size={14} />
              <span>Track Application Status</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: Ready to Start (Explicit Citizen Trigger & Permission Notice) */}
      {phase === 'READY_TO_START' && appDetail && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Application #{appDetail.id} — Verification Interview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Citizen: <strong>{appDetail.citizen_name}</strong> • Service: <strong>{appDetail.service_type?.replace(/_/g, ' ').toUpperCase()}</strong>
              </p>
            </div>
            <span className="badge badge-success text-xs">
              {appDetail.status === 'INTERVIEW_IN_PROGRESS' ? 'Interview In Progress' : 'Interview Available'}
            </span>
          </div>

          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-3">
            <Icon name="check-circle" size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Officer Document Review Passed:</strong> An authorized officer has reviewed your uploaded documents and approved your application for the factual verification interview.
            </div>
          </div>

          {/* Browser Media Device Information Prompt */}
          <div className="card p-5 space-y-3 bg-slate-50 dark:bg-slate-800/40">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Device Permissions & Requirements
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2">
                <Icon name="camera" size={14} className="text-teal-600 mt-0.5 shrink-0" />
                <span><strong>Camera:</strong> Displays a local video preview to assist you during the session.</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="mic" size={14} className="text-teal-600 mt-0.5 shrink-0" />
                <span><strong>Microphone:</strong> Allows you to speak your answers naturally (or use typed text answers).</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="shield" size={14} className="text-teal-600 mt-0.5 shrink-0" />
                <span><strong>Privacy:</strong> No raw audio or video streams are saved or transmitted to external servers.</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(appId ? `/status?id=${appId}${token ? `&token=${token}` : ''}` : '/status')}
            >
              Do This Later
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={handleStartInterviewSession}
            >
              <Icon name="camera" size={14} />
              <span>{loading ? 'Requesting Permissions & Starting...' : 'Enable Camera & Microphone and Start Interview →'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: Active Interview Session */}
      {phase === 'IN_SESSION' && session && session.questions && session.questions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Current Question & Answer Workbench */}
          <div className="md:col-span-2 card p-6 space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-semibold">Question {currentQIndex + 1} of {session.questions.length}</span>
              <span>Category: <strong className="text-slate-800 dark:text-slate-200">{extractQuestionCategory(session.questions[currentQIndex])}</strong></span>
            </div>

            {/* Question Text Display */}
            {(() => {
              const currentQ = session?.questions?.[currentQIndex]
              const questionText = extractQuestionText(currentQ, appDetail)

              if (!questionText) {
                return (
                  <div className="status-banner danger">
                    <Icon name="alert-circle" size={16} />
                    <span>Interview question unavailable. Please refresh the interview or return to the application.</span>
                  </div>
                )
              }

              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-l-4 border-teal-600 rounded-r-xl space-y-1">
                  <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="message" size={12} />
                    <span>Verification Question</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                    "{questionText}"
                  </div>
                </div>
              )
            })()}

            {/* Cross-Examination Result Breakdown */}
            {lastAnswerResult ? (
              <div className="space-y-4">
                <div
                  className={`card p-4 space-y-3 ${
                    lastAnswerResult.status === 'CONSISTENT'
                      ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-red-300 bg-red-50/40 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <strong className={`text-xs sm:text-sm flex items-center gap-1.5 ${lastAnswerResult.status === 'CONSISTENT' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                      <Icon name={lastAnswerResult.status === 'CONSISTENT' ? 'check-circle' : 'alert-circle'} size={16} />
                      <span>{lastAnswerResult.status === 'CONSISTENT' ? 'Answer Consistent with Records' : 'Cross-Document Discrepancy Detected'}</span>
                    </strong>
                    <span className={`badge ${lastAnswerResult.status === 'CONSISTENT' ? 'badge-success' : 'badge-danger'}`}>
                      {lastAnswerResult.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold uppercase block">Your Answer</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">"{lastAnswerResult.transcript_text || transcript}"</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold uppercase block">Document Evidence</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{session.questions[currentQIndex]?.expected_value || 'Submitted Records'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn btn-primary btn-sm" onClick={handleProceedNext} disabled={loading}>
                    <span>{currentQIndex + 1 < session.questions.length ? 'Next Question →' : 'Complete Interview →'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Voice / Speech Recognition Trigger */}
                <div className="flex justify-between items-center">
                  <label htmlFor="interview-answer" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Your Answer
                  </label>

                  <div className="flex gap-2">
                    {speechSupported && micState === 'active' && !useTypedFallback && (
                      <button
                        type="button"
                        className={`btn btn-sm ${isListening ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={toggleVoiceRecording}
                      >
                        <Icon name="mic" size={12} />
                        <span>{isListening ? 'Stop Speaking' : 'Start Speaking'}</span>
                      </button>
                    )}

                    {(!speechSupported || micState !== 'active' || useTypedFallback) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm text-[11px]"
                        onClick={() => setUseTypedFallback(false)}
                      >
                        Use Typed Answer
                      </button>
                    )}
                  </div>
                </div>

                {isListening && (
                  <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span><strong>Live transcript:</strong> "{transcript || 'Listening...'}"</span>
                  </div>
                )}

                {/* Response Textarea */}
                <textarea
                  id="interview-answer"
                  className="textarea-field text-xs sm:text-sm"
                  rows={3}
                  placeholder="Speak or type your factual answer clearly..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      stopAllMedia()
                      navigate(appId ? `/status?id=${appId}${token ? `&token=${token}` : ''}` : '/status')
                    }}
                  >
                    Pause / Continue Later
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    disabled={answering || !transcript.trim()}
                    onClick={handleSubmitAnswer}
                  >
                    <Icon name="send" size={14} />
                    <span>{answering ? 'Evaluating Consistency...' : 'Submit Answer →'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Camera Preview & Media Status */}
          <div className="card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Media Feeds
              </h4>
              <button
                type="button"
                className="btn btn-secondary btn-sm text-[11px]"
                onClick={cameraState === 'active' || micState === 'active' ? stopAllMedia : requestMediaPermissions}
              >
                {cameraState === 'active' || micState === 'active' ? 'Turn Off' : 'Enable Media'}
              </button>
            </div>

            {/* Video Preview Element */}
            <div className="w-full h-48 bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center text-slate-400 text-xs border border-slate-800 shadow-inner">
              {cameraState === 'active' ? (
                <>
                  <video
                    ref={(el) => {
                      videoRef.current = el
                      if (el && mediaStreamRef.current && cameraState === 'active') {
                        if (el.srcObject !== mediaStreamRef.current) {
                          el.srcObject = mediaStreamRef.current
                        }
                        el.play().catch((err) => console.warn('Video element play caught:', err))
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-xl"
                    onLoadedMetadata={(e) => {
                      e.target.play().catch(() => {})
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 shadow-sm border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Camera Active</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Icon name="camera" size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-300">
                      {cameraState === 'denied'
                        ? 'Camera access is blocked'
                        : cameraState === 'not_found'
                        ? 'Camera unavailable'
                        : cameraState === 'in_use'
                        ? 'Camera in use by another application'
                        : 'Camera is inactive'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {cameraState === 'denied'
                        ? 'Please allow camera in your browser address bar'
                        : 'You can complete all questions using text responses'}
                    </span>
                  </div>
                  {(cameraState === 'denied' || cameraState === 'off' || cameraState === 'error') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm text-[11px] mt-1"
                      onClick={requestMediaPermissions}
                    >
                      Allow Camera / Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Granular Camera & Microphone Status */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Camera Feed</span>
                <span
                  className={`font-bold ${
                    cameraState === 'active'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : cameraState === 'denied'
                      ? 'text-red-500'
                      : cameraState === 'not_found' || cameraState === 'in_use'
                      ? 'text-amber-500'
                      : 'text-slate-400'
                  }`}
                >
                  {cameraState === 'active'
                    ? 'Active'
                    : cameraState === 'denied'
                    ? 'Blocked'
                    : cameraState === 'not_found'
                    ? 'Unavailable'
                    : cameraState === 'in_use'
                    ? 'In Use'
                    : 'Off'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Microphone</span>
                <span
                  className={`font-bold ${
                    micState === 'active'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : micState === 'denied'
                      ? 'text-red-500'
                      : micState === 'not_found' || micState === 'in_use'
                      ? 'text-amber-500'
                      : 'text-slate-400'
                  }`}
                >
                  {micState === 'active'
                    ? 'Active'
                    : micState === 'denied'
                    ? 'Blocked'
                    : micState === 'not_found'
                    ? 'Unavailable'
                    : micState === 'in_use'
                    ? 'In Use'
                    : 'Off'}
                </span>
              </div>
            </div>

            {mediaErrorMessage && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                {mediaErrorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 5: Completed Summary */}
      {phase === 'COMPLETED' && summary && (
        <div className="card p-8 text-center space-y-6 max-w-xl mx-auto">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Icon name="check-circle" size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Verification Interview Completed!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your interview responses have been successfully recorded and submitted for Final Officer Review.
            </p>
          </div>

          <div className="card p-4 text-left space-y-2 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Consistency Assessment:</span>
              <span className={`badge ${summary.overall_consistency === 'CONSISTENT' ? 'badge-success' : 'badge-danger'}`}>
                {summary.overall_consistency || 'CONSISTENT'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {summary.summary_notes || 'All interview statements matched submitted document records.'}
            </p>
            <div className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 flex items-center gap-1">
              <Icon name="shield" size={12} />
              <span>{summary.disclaimer || 'AI-assisted factual cross-consistency with submitted records.'}</span>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(appId ? `/status?id=${appId}${token ? `&token=${token}` : ''}` : '/status')}
            >
              <Icon name="search" size={14} />
              <span>Track Application Status</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
