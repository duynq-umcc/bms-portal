import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    clearError()
    try {
      await login(data.email, data.password)
    } catch {
      // error handled in context
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber rounded-2xl shadow-lg mb-4">
            <span className="text-ink font-extrabold text-xl tracking-tight">BMS</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">BMS Hospital</h1>
          <p className="text-t3 text-sm mt-1">Hệ thống Quản lý Tòa nhà</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.07] p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Đăng nhập</h2>
          <p className="text-sm text-t3 mb-6">Nhập thông tin tài khoản để tiếp tục</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2.5 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                {...register('email')}
                placeholder="email@bms-hospital.vn"
                className="input-field"
                autoComplete="email"
                autoFocus
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t2 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber text-ink font-semibold rounded-lg text-sm
                         hover:bg-amber/90 active:bg-amber/80 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {isSubmitting || loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <p className="text-center text-t3 text-xs mt-6">
          © 2026 BMS Hospital Portal
        </p>
      </div>
    </div>
  )
}
