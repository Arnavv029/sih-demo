import bunny from '../assets/bunny.svg'
export default function Bunny({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={bunny} width={size} height={size} alt="" aria-hidden className={className} />
}
