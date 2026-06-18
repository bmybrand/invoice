import { FiCopy } from 'react-icons/fi'
import React from 'react'

interface PasswordGeneratorButtonProps {
  password: string
  setPassword: (val: string) => void
  onGenerate?: (password: string) => void
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

export const PasswordGeneratorButton: React.FC<PasswordGeneratorButtonProps> = ({ password, setPassword, onGenerate, className }) => (
  <div className={`mt-2 w-full ${className || ''}`}>
    <div className="flex w-full items-center rounded-xl bg-slate-700 p-1 transition-all duration-300 ease-out">
    <button
      type="button"
        className="flex h-12 flex-1 items-center justify-center rounded-[10px] px-4 py-0 text-sm font-semibold text-white transition-all duration-300 ease-out hover:bg-orange-500 focus:outline-none"
      style={{ minHeight: '3rem' }}
      onClick={() => {
        const nextPassword = generateStrongPassword()
        if (onGenerate) {
          onGenerate(nextPassword)
          return
        }
        setPassword(nextPassword)
      }}
    >
      {password ? 'Re-generate password' : 'Generate password'}
    </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${password ? 'ml-1 w-12 opacity-100' : 'ml-0 w-0 opacity-0'}`}
      >
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-[10px] text-white transition-all duration-300 ease-out hover:bg-orange-500 focus:outline-none disabled:pointer-events-none"
          style={{ minHeight: '3rem' }}
          title="Copy password"
          disabled={!password}
          tabIndex={password ? 0 : -1}
          aria-hidden={!password}
          onClick={() => { navigator.clipboard.writeText(password) }}
        >
          <FiCopy size={18} />
        </button>
      </div>
    </div>
  </div>
)
