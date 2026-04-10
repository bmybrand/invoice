'use client'

import { useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  leadingIcon?: ReactNode
  wrapperClassName: string
  inputClassName: string
  toggleClassName?: string
}

export function PasswordInput({
  leadingIcon,
  wrapperClassName,
  inputClassName,
  toggleClassName,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={wrapperClassName}>
      {leadingIcon}
      <input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={inputClassName}
      />
      <button
        type="button"
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        title={isVisible ? 'Hide password' : 'Show password'}
        onClick={() => setIsVisible((prev) => !prev)}
        className={toggleClassName ?? 'shrink-0 text-slate-400 transition hover:text-white focus:outline-none'}
      >
        {isVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
      </button>
    </div>
  )
}
