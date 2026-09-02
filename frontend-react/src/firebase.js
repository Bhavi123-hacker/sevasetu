/**
 * Firebase Modular Web SDK initialization and Email/Password Authentication helpers for SevaSetu.
 * Reads environment variables from VITE_FIREBASE_* without exposing secrets in source code.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
}

/**
 * Checks whether Firebase Authentication is configured with non-empty, non-placeholder credentials.
 */
export const isFirebaseConfigured = () => {
  const { apiKey, projectId, authDomain } = firebaseConfig
  return Boolean(
    apiKey &&
    apiKey.length > 5 &&
    !apiKey.includes('YOUR_') &&
    projectId &&
    projectId.length > 2 &&
    !projectId.includes('YOUR_') &&
    authDomain &&
    authDomain.length > 2 &&
    !authDomain.includes('YOUR_')
  )
}

// Initialize Firebase singleton
let app = null
let auth = null

try {
  if (isFirebaseConfigured()) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    auth = getAuth(app)
  }
} catch (err) {
  console.warn('Firebase Web SDK initialization notice:', err.message)
}

export { auth }

/**
 * Registers a new citizen using Firebase Email and Password Authentication.
 * Sets display name, sends email verification link, and returns user details.
 */
export const signUpWithEmail = async (name, email, password) => {
  if (!isFirebaseConfigured() || !auth) {
    throw {
      code: 'auth/not-configured',
      message: 'Firebase Authentication is not configured.',
    }
  }

  const cleanEmail = (email || '').trim().toLowerCase()
  const cleanName = (name || '').trim()

  if (!cleanEmail) throw { code: 'auth/invalid-email', message: 'Please enter a valid email address.' }
  if (!password || password.length < 6) throw { code: 'auth/weak-password', message: 'Password must contain at least 6 characters.' }

  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password)
  const user = userCredential.user

  if (cleanName) {
    try {
      await updateProfile(user, { displayName: cleanName })
    } catch (e) {
      console.warn('Could not update display name:', e)
    }
  }

  // Send verification email
  try {
    await sendEmailVerification(user)
  } catch (e) {
    console.warn('sendEmailVerification notice:', e)
  }

  const idToken = await user.getIdToken()
  return {
    user,
    idToken,
    email: user.email,
    displayName: cleanName || user.displayName,
    emailVerified: user.emailVerified,
  }
}

/**
 * Signs in an existing citizen using Firebase Email and Password.
 * Returns the user with ID token and email verification state.
 */
export const signInWithEmail = async (email, password) => {
  if (!isFirebaseConfigured() || !auth) {
    throw {
      code: 'auth/not-configured',
      message: 'Firebase Authentication is not configured.',
    }
  }

  const cleanEmail = (email || '').trim().toLowerCase()
  if (!cleanEmail) throw { code: 'auth/invalid-email', message: 'Please enter a valid email address.' }
  if (!password) throw { code: 'auth/missing-password', message: 'Please enter your password.' }

  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password)
  const user = userCredential.user
  const idToken = await user.getIdToken()
  return {
    user,
    idToken,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  }
}

/**
 * Explicitly sends/resends a verification email link to the current or specified user.
 */
export const resendVerificationEmail = async (targetUser = null) => {
  if (!isFirebaseConfigured() || !auth) {
    throw {
      code: 'auth/not-configured',
      message: 'Firebase Authentication is not configured.',
    }
  }

  const user = targetUser || auth.currentUser
  if (!user) {
    throw {
      code: 'auth/no-current-user',
      message: 'No active account found. Please sign in first.',
    }
  }

  await sendEmailVerification(user)
  return { success: true }
}

/**
 * Reloads the current user profile from Firebase to refresh emailVerified status.
 */
export const reloadAndCheckVerification = async (targetUser = null) => {
  if (!auth) return { emailVerified: false }
  const user = targetUser || auth.currentUser
  if (!user) return { emailVerified: false }

  try {
    await user.reload()
    const idToken = await user.getIdToken(true)
    return {
      emailVerified: Boolean(user.emailVerified),
      user,
      idToken,
    }
  } catch (err) {
    console.warn('reloadAndCheckVerification error:', err)
    return {
      emailVerified: Boolean(user.emailVerified),
      user,
    }
  }
}

/**
 * Sends a password reset email via Firebase.
 */
export const sendPasswordReset = async (email) => {
  if (!isFirebaseConfigured() || !auth) {
    throw {
      code: 'auth/not-configured',
      message: 'Firebase Authentication is not configured.',
    }
  }

  const cleanEmail = (email || '').trim().toLowerCase()
  if (!cleanEmail) throw { code: 'auth/invalid-email', message: 'Please enter your registered email address.' }

  await sendPasswordResetEmail(auth, cleanEmail)
  return { success: true }
}

/**
 * Safe signOut helper
 */
export const signOutFirebase = async () => {
  if (auth && auth.currentUser) {
    try {
      await firebaseSignOut(auth)
    } catch (err) {
      console.warn('Firebase signOut warning:', err)
    }
  }
}

/**
 * Maps Firebase Auth error codes to civic-friendly messages without exposing raw stack traces.
 * Logs the error code and message for development debugging (NEVER logs passwords).
 */
export const mapFirebaseAuthError = (error) => {
  if (!error) return 'An unexpected error occurred during verification.'
  const code = error.code || ''

  console.error('Firebase auth error:', code || 'UNKNOWN_CODE', error.message || error)

  switch (code) {
    case 'auth/not-configured':
      return 'Firebase Authentication is not configured. Please set up Firebase environment variables in .env.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Email or password is incorrect.'
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.'
    case 'auth/weak-password':
      return 'Password must contain at least 6 characters.'
    case 'auth/missing-password':
      return 'Please enter your password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few moments before trying again.'
    case 'auth/user-disabled':
      return 'This citizen account has been disabled. Please contact administration.'
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication provider is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.'
    case 'auth/invalid-api-key':
      return 'Firebase authentication is incorrectly configured. Please verify your VITE_FIREBASE_API_KEY.'
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
      return 'This application domain is not authorized in Firebase Console. Please add this domain under Firebase Console > Authentication > Settings > Authorized domains.'
    case 'auth/network-request-failed':
      return 'Unable to reach Firebase authentication service. Please check your internet connection or firewall.'
    case 'auth/internal-error':
      return 'Firebase authentication service encountered an internal error. Please retry in a few moments.'
    default:
      return error.message || 'Authentication failed. Please check your credentials and retry.'
  }
}
