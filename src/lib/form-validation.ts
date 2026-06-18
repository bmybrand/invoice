import type { FormEvent, InvalidEvent } from 'react'

type ValidatableFormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function isValidatableFormField(target: EventTarget | null): target is ValidatableFormField {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function handleRequiredFieldInvalid(event: InvalidEvent<HTMLFormElement>) {
  const target = event.target

  if (!isValidatableFormField(target)) {
    return
  }

  target.setCustomValidity(target.validity.valueMissing ? 'This field is empty.' : '')
}

export function clearRequiredFieldInvalid(event: FormEvent<HTMLFormElement>) {
  const target = event.target

  if (!isValidatableFormField(target)) {
    return
  }

  target.setCustomValidity('')
}
