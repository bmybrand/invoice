import { FiCopy } from 'react-icons/fi'
import React from 'react'

interface PasswordGeneratorButtonProps {
  password: string
  setPassword: (val: string) => void
  className?: string
}

function generateStrongPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  let password = ''
  for (let i = 0; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

export const PasswordGeneratorButton: React.FC<PasswordGeneratorButtonProps> = ({ password, setPassword, className }) => (
  <div className={`flex gap-2 w-full mt-2 ${className || ''}`}>
    <button
      type="button"
      className="flex-1 rounded-xl h-12 py-0 font-semibold text-sm focus:outline-none transition-all duration-200 bg-slate-700 text-white hover:bg-orange-500 flex items-center justify-center"
      style={{ minHeight: '3rem' }}
      onClick={() => setPassword(generateStrongPassword())}
    >
      {password ? 'Re-generate password' : 'Generate password'}
    </button>
    {password && (
      <button
        type="button"
        className="ml-1 px-3 h-12 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-orange-500 text-white transition-all duration-200"
        style={{ minHeight: '3rem' }}
        title="Copy password"
        onClick={() => { navigator.clipboard.writeText(password) }}
      >
        <FiCopy size={18} />
      </button>
    )}
  </div>
)
