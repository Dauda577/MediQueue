import { useId } from 'react'

interface AppLogoProps {
  size?: number
  className?: string
}

export default function AppLogo({ size = 40, className }: AppLogoProps) {
  const gradientId = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-label="MediQueue"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00A896" />
          <stop offset="0.55" stopColor="#05668D" />
          <stop offset="1" stopColor="#043a54" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1024" height="1024" rx="184.32" fill={`url(#${gradientId})`} />
      <rect x="409.6" y="163.84" width="204.8" height="696.32" rx="102.4" fill="#ffffff" />
      <rect x="163.84" y="409.6" width="696.32" height="204.8" rx="102.4" fill="#ffffff" />
      <g stroke="#00A896" strokeWidth="71.68" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M 81.92 512 L 339.968 512 L 417.3824 348.16 L 503.3984 602.112 L 572.2112 512 L 692.6336 512 L 770.048 675.84 L 856.064 512 L 942.08 512" />
      </g>
    </svg>
  )
}