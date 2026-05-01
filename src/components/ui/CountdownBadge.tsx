'use client'

import { useEffect, useState } from 'react'

interface Props {
  endDate: string
  accentColor: string
}

function getTimeLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function CountdownBadge({ endDate, accentColor }: Props) {
  const [label, setLabel] = useState(() => getTimeLeft(endDate))

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(getTimeLeft(endDate))
    }, 60_000) // actualiza cada minuto
    return () => clearInterval(interval)
  }, [endDate])

  if (!label) return (
    <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
      Finalizado
    </span>
  )

  const isUrgent = new Date(endDate).getTime() - Date.now() < 24 * 60 * 60 * 1000

  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{
        color: isUrgent ? '#f87171' : accentColor,
        backgroundColor: isUrgent ? 'rgba(248,113,113,0.1)' : `${accentColor}1a`,
      }}
    >
      ⏱ {label}
    </span>
  )
}
