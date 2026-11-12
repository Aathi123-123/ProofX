interface ProofXIconProps {
  className?: string
  size?: number | string
  accentColor?: string
  baseColor?: string
}

export function ProofXIcon({
  className = '',
  size = 28,
  accentColor = '#00a87d',
  baseColor = 'currentColor',
}: ProofXIconProps) {
  return (
    <svg
      viewBox="0 0 316 252"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: 'auto', aspectRatio: '316/252' }}
      className={`inline-block flex-shrink-0 ${className}`}
    >
      {/* Bottom-left diagonal slash */}
      <path d="M 0 248 L 68 248 L 172 144 L 138 110 Z" fill={baseColor} />
      {/* Main backslash stroke */}
      <path d="M 0 44 L 68 44 L 272 248 L 204 248 Z" fill={baseColor} />
      {/* Top-right vibrant green checkmark / arrow stroke */}
      <path d="M 138 110 L 246 2 L 314 2 L 172 144 Z" fill={accentColor} />
    </svg>
  )
}

interface ProofXLogoProps {
  className?: string
  iconSize?: number
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
  subtitle?: string
  showSubtitle?: boolean
  inverted?: boolean // if true, uses dark navy text for light backgrounds
}

export function ProofXLogo({
  className = '',
  iconSize = 28,
  textSize = 'md',
  subtitle = 'Digital Forensics',
  showSubtitle = true,
  inverted = false,
}: ProofXLogoProps) {
  const fontSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const baseTextColor = inverted ? 'text-[#0d1424]' : 'text-white'
  const iconBaseColor = inverted ? '#0d1424' : '#ffffff'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ProofXIcon size={iconSize} baseColor={iconBaseColor} accentColor="#00a87d" />
      <div className="flex flex-col justify-center">
        <div className="flex items-center leading-none">
          <span className={`font-extrabold tracking-tight ${fontSizes[textSize]} ${baseTextColor}`}>
            Proof
          </span>
          <span className={`font-extrabold tracking-tight ${fontSizes[textSize]} text-[#00a87d]`}>
            X
          </span>
        </div>
        {showSubtitle && subtitle && (
          <p className="text-[hsl(215,20.2%,50%)] text-[10px] font-medium tracking-wider uppercase leading-none mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

export default ProofXLogo
