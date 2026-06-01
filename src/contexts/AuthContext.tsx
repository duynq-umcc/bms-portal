import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { UserProfile, Department } from '@/firebase/types'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string, dept: Department) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          setState({ user: { uid: firebaseUser.uid, ...snap.data() } as UserProfile, loading: false, error: null })
        } else {
          // User authenticated but no profile — create default
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            dept: 'viewer',
            role: 'technician',
            position: '',
            status: 'active',
            createdAt: serverTimestamp() as never,
          }
          await setDoc(doc(db, 'users', firebaseUser.uid), profile)
          setState({ user: profile, loading: false, error: null })
        }
      } else {
        setState({ user: null, loading: false, error: null })
      }
    })
    return unsub
  }, [])

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Đăng nhập thất bại'
      setState((s) => ({ ...s, loading: false, error: msg }))
      throw e
    }
  }

  const register = async (email: string, password: string, displayName: string, dept: Department) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })
      const profile: Omit<UserProfile, 'uid'> = {
        email,
        displayName,
        dept,
        role: 'technician',
        position: '',
        status: 'active',
        createdAt: serverTimestamp() as never,
      }
      await setDoc(doc(db, 'users', cred.user.uid), profile)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Đăng ký thất bại'
      setState((s) => ({ ...s, loading: false, error: msg }))
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const clearError = () => setState((s) => ({ ...s, error: null }))

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
