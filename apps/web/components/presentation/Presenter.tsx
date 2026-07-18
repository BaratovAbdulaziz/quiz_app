"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Play, Pause, Grid3x3, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Slide {
  _id: string
  title: string
  content: string[]
  layout: string
  order: number
  imageUrl?: string
  fontSize?: string
  speakerNotes?: string
}

interface PresenterProps {
  slides: Slide[]
  title: string
  theme: string
  size?: string
  showWatermark?: boolean
  onClose: () => void
}

const themes: Record<string, {
  bg: string
  titleFont: string
  bodyFont: string
  titleColor: string
  bodyColor: string
  accent: string
  mutedColor: string
  cardBg: string
  stripBg: string
  accentLight: string
}> = {
  claude: {
    bg: "bg-[#faf9f5]",
    titleFont: "font-serif",
    bodyFont: "font-dm",
    titleColor: "text-[#141413]",
    bodyColor: "text-[#3d3d3a]",
    accent: "#cc785c",
    mutedColor: "text-[#6c6a64]",
    cardBg: "bg-[#181715]",
    stripBg: "bg-[#cc785c]",
    accentLight: "bg-[#e8c4b0]",
  },
  apple: {
    bg: "bg-white",
    titleFont: "font-display font-semibold tracking-tight",
    bodyFont: "font-outfit",
    titleColor: "text-[#1d1d1f]",
    bodyColor: "text-[#333333]",
    accent: "#0066cc",
    mutedColor: "text-[#6e6e73]",
    cardBg: "bg-[#f5f5f7]",
    stripBg: "bg-[#0066cc]",
    accentLight: "bg-[#d6eaff]",
  },
  hp: {
    bg: "bg-white",
    titleFont: "font-grotesk font-medium",
    bodyFont: "font-dm",
    titleColor: "text-[#1a1a1a]",
    bodyColor: "text-[#333333]",
    accent: "#024ad8",
    mutedColor: "text-[#636363]",
    cardBg: "bg-[#f0f4ff]",
    stripBg: "bg-[#024ad8]",
    accentLight: "bg-[#d6deff]",
  },
  minimal: {
    bg: "bg-white",
    titleFont: "font-semibold",
    bodyFont: "",
    titleColor: "text-[#111111]",
    bodyColor: "text-[#333333]",
    accent: "#111111",
    mutedColor: "text-[#888888]",
    cardBg: "bg-[#f5f5f5]",
    stripBg: "bg-[#111111]",
    accentLight: "bg-[#e5e5e5]",
  },
  dark: {
    bg: "bg-[#0f0f0f]",
    titleFont: "font-semibold",
    bodyFont: "",
    titleColor: "text-white",
    bodyColor: "text-white/80",
    accent: "#a78bfa",
    mutedColor: "text-white/50",
    cardBg: "bg-white/5",
    stripBg: "bg-[#a78bfa]",
    accentLight: "bg-[#a78bfa]/20",
  },
  gradient: {
    bg: "bg-gradient-to-br from-orange-50 to-pink-50",
    titleFont: "font-bold",
    bodyFont: "",
    titleColor: "text-[#1a1a1a]",
    bodyColor: "text-[#333333]",
    accent: "#f97316",
    mutedColor: "text-[#666666]",
    cardBg: "bg-white/70",
    stripBg: "bg-gradient-to-r from-[#f97316] to-[#ec4899]",
    accentLight: "bg-orange-100",
  },
  nature: {
    bg: "bg-[#f5f0e8]",
    titleFont: "font-serif",
    bodyFont: "",
    titleColor: "text-[#1a2e1a]",
    bodyColor: "text-[#2d3a2d]",
    accent: "#2d6a4f",
    mutedColor: "text-[#5a6b5a]",
    cardBg: "bg-[#e8e0d0]",
    stripBg: "bg-[#2d6a4f]",
    accentLight: "bg-[#d4e8dc]",
  },
  neon: {
    bg: "bg-[#0a0a0a]",
    titleFont: "font-bold",
    bodyFont: "",
    titleColor: "text-white",
    bodyColor: "text-white/80",
    accent: "#22d3ee",
    mutedColor: "text-white/50",
    cardBg: "bg-white/5",
    stripBg: "bg-[#22d3ee]",
    accentLight: "bg-[#22d3ee]/15",
  },
  corporate: {
    bg: "bg-[#f8fafc]",
    titleFont: "font-semibold",
    bodyFont: "",
    titleColor: "text-[#0f172a]",
    bodyColor: "text-[#334155]",
    accent: "#1e40af",
    mutedColor: "text-[#64748b]",
    cardBg: "bg-[#e2e8f0]",
    stripBg: "bg-[#1e40af]",
    accentLight: "bg-[#dbeafe]",
  },
}

function FadeIn({ children, delay = 0, className = "", variant = "up" }: { children: React.ReactNode; delay?: number; className?: string; variant?: "up" | "scale" | "left" | "right" | "fade" | "blur" | "rotate" | "parallax" | "bounce" | "typewriter" | "flipX" | "flipY" | "zoomBlur" | "rise" }) {
  const variants = {
    up: { initial: { opacity: 0, y: 35 }, animate: { opacity: 1, y: 0 } },
    scale: { initial: { opacity: 0, scale: 0.75 }, animate: { opacity: 1, scale: 1 } },
    left: { initial: { opacity: 0, x: -45 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: 45 }, animate: { opacity: 1, x: 0 } },
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    blur: { initial: { opacity: 0, filter: "blur(12px)", scale: 1.02 }, animate: { opacity: 1, filter: "blur(0px)", scale: 1 } },
    rotate: { initial: { opacity: 0, rotate: -4, scale: 0.93 }, animate: { opacity: 1, rotate: 0, scale: 1 } },
    parallax: { initial: { opacity: 0, y: 50, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } },
    bounce: { initial: { opacity: 0, y: 35, scale: 0.85 }, animate: { opacity: 1, y: 0, scale: 1 } },
    typewriter: { initial: { opacity: 0, clipPath: "inset(0 100% 0 0)" }, animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" } },
    flipX: { initial: { opacity: 0, rotateX: 90, transformPerspective: 400 }, animate: { opacity: 1, rotateX: 0, transformPerspective: 400 } },
    flipY: { initial: { opacity: 0, rotateY: 90, transformPerspective: 400 }, animate: { opacity: 1, rotateY: 0, transformPerspective: 400 } },
    zoomBlur: { initial: { opacity: 0, scale: 1.2, filter: "blur(8px)" }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" } },
    rise: { initial: { opacity: 0, y: 45, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 } },
  }
  const v = variants[variant] || variants.up
  const springs: Record<string, object> = {
    bounce: { type: "spring", stiffness: 450, damping: 14, mass: 0.7 },
    scale: { type: "spring", stiffness: 350, damping: 18, mass: 0.5 },
    flipX: { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
    flipY: { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
    zoomBlur: { type: "spring", stiffness: 250, damping: 22, mass: 0.7 },
    rise: { type: "spring", stiffness: 200, damping: 24, mass: 0.9 },
  }
  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      transition={springs[variant] || { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function ShimmerLine({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn("absolute overflow-hidden", className)}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 }}
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)" }}
      />
    </motion.div>
  )
}

function FloatingDecor({ delay = 0, className = "", variant = "float" }: { delay?: number; className?: string; variant?: "float" | "drift" | "pulse" | "spin" }) {
  const animations = {
    float: { y: [0, -8, 0], rotate: [0, 1.5, -1, 0] },
    drift: { x: [0, 5, -3, 0], y: [0, -4, 2, 0] },
    pulse: { scale: [1, 1.05, 1], opacity: [1, 0.8, 1] },
    spin: { rotate: [0, 360] },
  }
  const dur = variant === "spin" ? 20 : 4 + delay
  return (
    <motion.div
      animate={animations[variant] || animations.float}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay }}
      className={className}
    />
  )
}

function SlideWatermark({ theme }: { theme: string }) {
  const colors: Record<string, string> = {
    claude: "bg-[#cc785c]",
    apple: "bg-[#0066cc]",
    hp: "bg-[#024ad8]",
    minimal: "bg-[#111111]",
    dark: "bg-[#a78bfa]",
    gradient: "bg-[#f97316]",
    nature: "bg-[#2d6a4f]",
    neon: "bg-[#22d3ee]",
    corporate: "bg-[#1e40af]",
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.3 }}
      className="absolute top-6 left-6"
    >
      <div className={cn("w-1 h-8 rounded-full", colors[theme] || colors.claude)} />
    </motion.div>
  )
}

function getTransitionVariant(layout: string, direction: number) {
  if (layout === "sectionDivider" || layout === "closing") {
    return {
      enter: (d: number) => ({ opacity: 0, scale: 1.15, filter: "blur(10px)", rotate: d > 0 ? 1 : -1 }),
      center: { opacity: 1, scale: 1, filter: "blur(0px)", rotate: 0 },
      exit: (d: number) => ({ opacity: 0, scale: 0.85, filter: "blur(10px)", rotate: d > 0 ? -1 : 1 }),
    }
  }
  if (layout === "title") {
    return {
      enter: (d: number) => ({ opacity: 0, y: d > 0 ? 100 : -100, scale: 0.92, filter: "blur(4px)" }),
      center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
      exit: (d: number) => ({ opacity: 0, y: d > 0 ? -60 : 60, scale: 0.92, filter: "blur(4px)" }),
    }
  }
  if (layout === "quote") {
    return {
      enter: (d: number) => ({ opacity: 0, x: d > 0 ? 120 : -120, rotate: d > 0 ? 3 : -3, scale: 0.96 }),
      center: { opacity: 1, x: 0, rotate: 0, scale: 1 },
      exit: (d: number) => ({ opacity: 0, x: d > 0 ? -120 : 120, rotate: d > 0 ? -3 : 3, scale: 0.96 }),
    }
  }
  if (layout === "stats" || layout === "timeline") {
    return {
      enter: (d: number) => ({ opacity: 0, y: 60, scale: 0.9, filter: "blur(3px)" }),
      center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
      exit: (d: number) => ({ opacity: 0, y: -50, scale: 0.96, filter: "blur(3px)" }),
    }
  }
  if (layout === "twoColumn" || layout === "comparison") {
    return {
      enter: (d: number) => ({ opacity: 0, x: d > 0 ? "18%" : "-18%", rotateY: d > 0 ? 10 : -10, filter: "blur(2px)" }),
      center: { opacity: 1, x: 0, rotateY: 0, filter: "blur(0px)" },
      exit: (d: number) => ({ opacity: 0, x: d > 0 ? "-18%" : "18%", rotateY: d > 0 ? -10 : 10, filter: "blur(2px)" }),
    }
  }
  if (layout === "numberedSteps") {
    return {
      enter: (d: number) => ({ opacity: 0, y: 40, x: d > 0 ? 30 : -30, filter: "blur(2px)" }),
      center: { opacity: 1, y: 0, x: 0, filter: "blur(0px)" },
      exit: (d: number) => ({ opacity: 0, y: -40, x: d > 0 ? -30 : 30, filter: "blur(2px)" }),
    }
  }
  return {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? "14%" : "-14%", filter: "blur(4px)", scale: 0.97 }),
    center: { opacity: 1, x: 0, filter: "blur(0px)", scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? "-14%" : "14%", filter: "blur(4px)", scale: 0.97 }),
  }
}

function ImageWithLoader({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [retries, setRetries] = useState(0)
  const [failed, setFailed] = useState(false)
  const maxRetries = 1

  const handleError = () => {
    if (retries < maxRetries) {
      setRetries(r => r + 1)
    } else {
      setFailed(true)
    }
  }

  if (failed) return null

  const currentSrc = retries > 0 ? `${src}&retry=${retries}` : src

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={cn(className, !loaded && "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </>
  )
}

function SlideRenderer({ slide, ts, theme, showWatermark = true }: { slide: Slide; ts: typeof themes.claude; theme: string; showWatermark?: boolean }) {
  const isTitle = slide.layout === "title"
  const isSection = slide.layout === "sectionDivider"
  const isStats = slide.layout === "stats"
  const isQuote = slide.layout === "quote"
  const isTwoCol = slide.layout === "twoColumn" && slide.content.length === 2
  const isTimeline = slide.layout === "timeline"
  const isComparison = slide.layout === "comparison"
  const isImageFocused = slide.layout === "imageFocused"
  const isNumberedSteps = slide.layout === "numberedSteps"
  const isClosing = slide.layout === "closing"

  const fontScale = slide.fontSize === "xs" ? 0.75 : slide.fontSize === "sm" ? 0.875 : slide.fontSize === "lg" ? 1.15 : slide.fontSize === "xl" ? 1.3 : 1

  function Decorations({ layout }: { layout: string }) {
    if (layout === "stats" || layout === "quote") return null
    if (theme === "claude") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-40 h-40 rounded-full bg-[#e8c4b0]/30" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-24 h-24 rounded-full bg-[#e8c4b0]/20" />
          <FloatingDecor delay={0.5} variant="pulse" className="absolute top-32 left-8 w-3 h-3 rounded-full bg-[#cc785c]/15" />
          <div className="absolute bottom-32 right-24 w-2 h-2 rounded-full bg-[#cc785c]/20" />
          <div className="absolute top-1/4 left-[15%] w-1.5 h-1.5 rounded-full bg-[#e8c4b0]/40" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#cc785c]/10" delay={0.2} />
          <ShimmerLine className="absolute bottom-1/3 right-[10%] w-20 h-px bg-[#e8c4b0]/15" delay={0.6} />
        </>
      )
      if (layout === "sectionDivider") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-12 right-12 w-32 h-32 rounded-full bg-white/15" />
          <FloatingDecor delay={0.8} variant="drift" className="absolute bottom-12 left-16 w-16 h-16 rounded-full bg-white/10" />
          <FloatingDecor delay={0.4} variant="pulse" className="absolute top-1/3 left-[10%] w-4 h-4 rounded-full bg-white/10" />
          <div className="absolute bottom-1/4 right-[15%] w-2 h-2 rounded-full bg-white/20" />
          <ShimmerLine className="absolute top-8 left-1/2 w-24 h-px bg-white/20" delay={0.3} />
          <ShimmerLine className="absolute bottom-10 right-[20%] w-16 h-px bg-white/15" delay={0.5} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-20 h-20 rounded-full bg-[#e8c4b0]/12" />
          <FloatingDecor delay={1.2} variant="drift" className="absolute bottom-10 left-6 w-12 h-12 rounded-full bg-[#e8c4b0]/10" />
          <div className="absolute top-[20%] right-[8%] w-2 h-2 rounded-full bg-[#cc785c]/15" />
          <div className="absolute bottom-[25%] left-[5%] w-3 h-3 rounded-full bg-[#e8c4b0]/20" />
          <div className="absolute top-1/2 right-4 w-1 h-1 rounded-full bg-[#cc785c]/25" />
          <div className="absolute bottom-20 right-[20%] w-1.5 h-1.5 rounded-full bg-[#e8c4b0]/30" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#cc785c]/10" delay={0.4} />
        </>
      )
    }
    if (theme === "apple") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-12 right-12 w-48 h-48 rounded-full bg-[#d6eaff]/40" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-8 left-8 w-16 h-16 rounded-full bg-[#0066cc]/5" />
          <div className="absolute top-1/3 left-[12%] w-2 h-2 rounded-full bg-[#0066cc]/10" />
          <div className="absolute bottom-[30%] right-[10%] w-1.5 h-1.5 rounded-full bg-[#0066cc]/15" />
          <ShimmerLine className="absolute top-1/2 left-1/4 w-20 h-px bg-[#0066cc]/8" delay={0.3} />
        </>
      )
      if (layout === "sectionDivider") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-8 right-8 w-40 h-40 rounded-full bg-white/10" />
          <FloatingDecor delay={0.6} variant="drift" className="absolute bottom-6 left-10 w-20 h-20 rounded-full bg-white/8" />
          <div className="absolute top-[25%] left-[8%] w-3 h-3 rounded-full bg-white/12" />
          <div className="absolute bottom-[20%] right-[12%] w-1.5 h-1.5 rounded-full bg-white/15" />
          <ShimmerLine className="absolute top-6 left-1/3 w-24 h-px bg-white/15" delay={0.4} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-8 right-12 w-24 h-24 rounded-full bg-[#d6eaff]/20" />
          <FloatingDecor delay={1.5} variant="drift" className="absolute bottom-12 left-8 w-14 h-14 rounded-full bg-[#d6eaff]/15" />
          <div className="absolute top-[15%] right-[6%] w-2 h-2 rounded-full bg-[#0066cc]/8" />
          <div className="absolute bottom-[20%] left-[4%] w-1.5 h-1.5 rounded-full bg-[#0066cc]/12" />
          <ShimmerLine className="absolute top-1/2 left-6 w-14 h-px bg-[#0066cc]/10" delay={0.5} />
        </>
      )
    }
    if (theme === "hp") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 left-0 w-10 h-32 bg-[#024ad8]/10 rounded-r" />
          <FloatingDecor delay={0.8} variant="drift" className="absolute top-16 right-0 w-10 h-32 bg-[#024ad8]/10 rounded-l" />
          <FloatingDecor delay={0.3} variant="spin" className="absolute bottom-10 right-[15%] w-12 h-12 bg-[#024ad8]/5 rounded-lg" />
          <div className="absolute top-[20%] left-[8%] w-2 h-2 bg-[#024ad8]/10 rounded-sm" style={{ transform: "rotate(30deg)" }} />
          <ShimmerLine className="absolute top-1/2 left-[10%] w-20 h-px bg-[#024ad8]/10" delay={0.3} />
        </>
      )
      if (layout === "sectionDivider") return (
        <>
          <div className="absolute top-6 left-0 right-0 h-px bg-white/20" />
          <div className="absolute bottom-6 left-0 right-0 h-px bg-white/20" />
          <FloatingDecor delay={0} variant="pulse" className="absolute top-[20%] left-[8%] w-3 h-3 rounded-full bg-white/8" />
          <div className="absolute bottom-[25%] right-[10%] w-2 h-2 rounded-full bg-white/12" />
          <ShimmerLine className="absolute top-1/2 right-[15%] w-16 h-px bg-white/10" delay={0.5} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-8 right-8 w-16 h-16 bg-[#024ad8]/4 rounded-lg" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-12 left-6 w-8 h-8 bg-[#024ad8]/6 rounded" />
          <div className="absolute top-[18%] right-[5%] w-1.5 h-1.5 rounded-full bg-[#024ad8]/10" />
          <div className="absolute bottom-[22%] left-[3%] w-2 h-2 bg-[#024ad8]/8 rounded-sm" style={{ transform: "rotate(45deg)" }} />
          <ShimmerLine className="absolute top-1/2 right-6 w-12 h-px bg-[#024ad8]/10" delay={0.4} />
        </>
      )
    }
    if (theme === "minimal") {
      return null
    }
    if (theme === "dark") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-40 h-40 rounded-full bg-[#a78bfa]/10" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-24 h-24 rounded-full bg-[#a78bfa]/8" />
          <div className="absolute top-1/4 left-[15%] w-1.5 h-1.5 rounded-full bg-[#a78bfa]/20" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#a78bfa]/10" delay={0.2} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-20 h-20 rounded-full bg-[#a78bfa]/5" />
          <div className="absolute top-[20%] right-[8%] w-2 h-2 rounded-full bg-[#a78bfa]/10" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#a78bfa]/8" delay={0.4} />
        </>
      )
    }
    if (theme === "gradient") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-48 h-48 rounded-full bg-[#f97316]/10" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-32 h-32 rounded-full bg-[#ec4899]/8" />
          <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-[#f97316]/15" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#f97316]/10" delay={0.2} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-24 h-24 rounded-full bg-[#ec4899]/8" />
          <div className="absolute bottom-10 left-6 w-12 h-12 rounded-full bg-[#f97316]/6" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#f97316]/8" delay={0.4} />
        </>
      )
    }
    if (theme === "nature") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-40 h-40 rounded-full bg-[#2d6a4f]/10" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-24 h-24 rounded-full bg-[#2d6a4f]/8" />
          <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-[#2d6a4f]/12" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#2d6a4f]/8" delay={0.2} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-20 h-20 rounded-full bg-[#2d6a4f]/5" />
          <div className="absolute bottom-10 left-6 w-12 h-12 rounded-full bg-[#2d6a4f]/4" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#2d6a4f]/6" delay={0.4} />
        </>
      )
    }
    if (theme === "neon") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-40 h-40 rounded-full bg-[#22d3ee]/8" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-24 h-24 rounded-full bg-[#22d3ee]/6" />
          <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-[#22d3ee]/15" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#22d3ee]/10" delay={0.2} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-20 h-20 rounded-full bg-[#22d3ee]/4" />
          <div className="absolute bottom-10 left-6 w-12 h-12 rounded-full bg-[#22d3ee]/3" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#22d3ee]/6" delay={0.4} />
        </>
      )
    }
    if (theme === "corporate") {
      if (layout === "title") return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-16 right-16 w-40 h-40 rounded-full bg-[#1e40af]/8" />
          <FloatingDecor delay={1} variant="drift" className="absolute bottom-16 left-16 w-24 h-24 rounded-full bg-[#1e40af]/6" />
          <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-[#1e40af]/10" />
          <ShimmerLine className="absolute top-8 left-1/3 w-32 h-px bg-[#1e40af]/8" delay={0.2} />
        </>
      )
      return (
        <>
          <FloatingDecor delay={0} variant="float" className="absolute top-6 right-10 w-20 h-20 rounded-full bg-[#1e40af]/4" />
          <div className="absolute bottom-10 left-6 w-12 h-12 rounded-full bg-[#1e40af]/3" />
          <ShimmerLine className="absolute top-[30%] left-4 w-16 h-px bg-[#1e40af]/6" delay={0.4} />
        </>
      )
    }
    return null
  }

  return (
    <div className={cn("w-full h-full flex flex-col relative overflow-hidden", ts.bg)} style={fontScale !== 1 ? { fontSize: `${fontScale * 100}%` } : undefined}>
      {theme === "claude" && <div className={cn("h-2 absolute top-0 left-0 right-0 z-10", ts.stripBg)} />}
      {theme === "hp" && (
        <div className={cn("h-8 flex items-center gap-1.5 px-4 absolute top-0 left-0 right-0 z-10", ts.stripBg)}>
          <div className="w-1.5 h-4 bg-white/40 rounded-full" />
          <div className="w-1.5 h-4 bg-white/40 rounded-full" />
          <div className="flex-1" />
          <span className="text-[10px] text-white/80 font-medium uppercase tracking-wider">HP</span>
        </div>
      )}
      {theme === "apple" && <div className="h-1 bg-[#0066cc] absolute top-0 left-0 right-0 z-10" />}

      <Decorations layout={slide.layout} />

      {isTitle && (
        <div className="flex-1 flex items-center justify-center px-16 pb-4 relative">
          <SlideWatermark theme={theme} />
          {theme === "claude" && (
            <>
              <div className="rounded-2xl px-10 py-8 bg-[#181715] max-w-2xl w-full relative z-10">
                <FadeIn variant="scale"><div className="w-12 h-1 bg-[#cc785c] rounded mb-5" /></FadeIn>
                <FadeIn delay={0.12} variant="up"><div className={cn("text-4xl font-bold text-white mb-3", ts.titleFont)}>{slide.title}</div></FadeIn>
                {slide.content.length > 0 && (
                  <FadeIn delay={0.24} variant="left"><div className="text-lg text-[#cc785c]">{slide.content[0]}</div></FadeIn>
                )}
              </div>
            </>
          )}
          {theme === "apple" && (
            <>
              <div className="max-w-2xl w-full relative z-10">
                <FadeIn variant="scale"><div className="w-10 h-1 bg-[#0066cc] rounded mb-6" /></FadeIn>
                <FadeIn delay={0.12} variant="blur"><div className={cn("text-5xl font-bold mb-4", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
                {slide.content.length > 0 && (
                  <FadeIn delay={0.24} variant="left"><div className={cn("text-xl mt-2", ts.mutedColor)}>{slide.content[0]}</div></FadeIn>
                )}
              </div>
            </>
          )}
          {theme === "hp" && (
            <>
              <div className="max-w-2xl w-full relative z-10">
                <FadeIn variant="up"><div className={cn("text-4xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
                {slide.content.length > 0 && (
                  <FadeIn delay={0.12} variant="left"><div className={cn("text-lg mt-2", ts.mutedColor)}>{slide.content[0]}</div></FadeIn>
                )}
                <FadeIn delay={0.24} variant="scale"><div className="w-16 h-1 bg-[#024ad8] rounded mt-4" /></FadeIn>
              </div>
            </>
          )}
        </div>
      )}

      {isSection && (
        <div className={cn("flex-1 flex items-center justify-center px-12 relative", 
          theme === "claude" && "bg-[#a8553a]", 
          theme === "apple" && "bg-[#0066cc]", 
          theme === "hp" && "bg-[#024ad8]",
          theme === "minimal" && "bg-[#111111]",
          theme === "dark" && "bg-[#1a1a2e]",
          theme === "gradient" && "bg-gradient-to-r from-[#f97316] to-[#ec4899]",
          theme === "nature" && "bg-[#2d6a4f]",
          theme === "neon" && "bg-[#0a1628]",
          theme === "corporate" && "bg-[#1e293b]",
        )}>
          <div className="text-center relative z-10">
            <FadeIn variant="scale"><div className="text-4xl font-bold text-white mb-3">{slide.title}</div></FadeIn>
            {slide.content.length > 0 && (
              <FadeIn delay={0.15} variant="up"><div className="text-lg text-white">{slide.content[0]}</div></FadeIn>
            )}
          </div>
        </div>
      )}

      {isStats && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-8 pb-4 relative z-10">
          <FadeIn variant="parallax"><div className={cn("text-2xl font-bold mb-2", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="w-16 h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          {(() => {
            const stats = slide.content.filter((c: string) => c.includes("|")).slice(0, 4)
            const cols = stats.length <= 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
            return (
              <div className={cn("grid gap-5 max-w-5xl", cols)}>
                {stats.map((stat: string, i: number) => {
                  const [num, label] = stat.split("|")
                  return (
                    <FadeIn key={i} delay={0.1 + i * 0.12} variant={i % 2 === 0 ? "bounce" : "parallax"}>
                      <div className={cn("rounded-xl px-5 py-6 text-center", theme === "claude" ? "bg-[#181715]" : (i % 2 === 0 ? ts.accentLight : ts.cardBg))}>
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.2 + i * 0.12 }}
                          className={cn("text-3xl font-bold leading-tight", theme === "claude" ? "text-[#cc785c]" : "")}
                          style={theme !== "claude" ? { color: ts.accent } : undefined}
                        >{num}</motion.div>
                        <div className={cn("text-xs mt-2.5 leading-snug min-h-[2.5em] flex items-center justify-center", theme === "claude" ? "text-white/80" : ts.mutedColor)}>{label}</div>
                      </div>
                    </FadeIn>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {isQuote && (
        <div className="flex-1 flex items-center justify-center px-16 pb-4 relative z-10">
          <div className="max-w-3xl w-full">
            {theme === "claude" && (
              <>
                <FadeIn variant="rotate"><div className="text-8xl font-serif text-[#e8c4b0]/60 leading-none mb-2">{"\u201C"}</div></FadeIn>
                <FadeIn delay={0.1} variant="left"><div className="text-2xl italic text-[#141413] leading-relaxed pl-4">{slide.content[0]}</div></FadeIn>
                {slide.content.length > 1 && (
                  <>
                    <FadeIn delay={0.2} variant="scale"><div className="w-12 h-px bg-[#cc785c] mt-6 mb-2" /></FadeIn>
                    <FadeIn delay={0.28} variant="typewriter"><div className="text-base text-[#6c6a64] pl-4">{slide.content[1]}</div></FadeIn>
                  </>
                )}
              </>
            )}
            {theme === "apple" && (
              <div className="flex gap-4">
                <FadeIn variant="scale"><div className="w-2 bg-[#0066cc] rounded-full shrink-0" /></FadeIn>
                <div>
                  <FadeIn delay={0.1} variant="left"><div className="text-2xl italic text-[#1d1d1f] leading-relaxed">{slide.content[0]}</div></FadeIn>
                  {slide.content.length > 1 && (
                    <FadeIn delay={0.2} variant="typewriter"><div className="text-base text-[#0066cc] font-medium mt-4">{slide.content[1]}</div></FadeIn>
                  )}
                </div>
              </div>
            )}
            {theme === "hp" && (
              <div className="flex gap-4">
                <FadeIn variant="scale"><div className="w-2 bg-[#024ad8] rounded-full shrink-0" /></FadeIn>
                <div>
                  <FadeIn delay={0.1} variant="left"><div className="text-2xl italic text-[#1a1a1a] leading-relaxed">{slide.content[0]}</div></FadeIn>
                  {slide.content.length > 1 && (
                    <FadeIn delay={0.2} variant="typewriter"><div className="text-base text-[#024ad8] font-medium mt-4">{slide.content[1]}</div></FadeIn>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TIMELINE */}
      {isTimeline && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="up"><div className={cn("text-2xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          <div className="relative max-w-4xl">
            <div className="absolute left-[28px] top-0 bottom-0 w-0.5" style={{ backgroundColor: ts.accent + "30" }} />
            {slide.content.slice(0, 6).map((item: string, i: number) => {
              const [year, ...eventParts] = item.split("|")
              const event = eventParts.join("|")
              return (
                <FadeIn key={i} delay={0.1 + i * 0.1} variant="left">
                  <div className="flex items-start gap-4 mb-4 last:mb-0">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white z-10" style={{ backgroundColor: ts.accent }}>
                      {year}
                    </div>
                    <div className={cn("flex-1 rounded-xl px-5 py-3", ts.cardBg)}>
                      <div className={cn("text-sm leading-snug", ts.bodyColor)}>{event}</div>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      )}

      {/* COMPARISON */}
      {isComparison && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="up"><div className={cn("text-2xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          <div className="grid grid-cols-2 gap-5 max-w-4xl">
            {slide.content.slice(0, 2).map((col: string, i: number) => {
              const [colTitle, ...items] = col.split("|")
              const colItems = items.join("|").split("\\n").filter(Boolean)
              return (
                <FadeIn key={i} delay={0.15 + i * 0.15} variant={i === 0 ? "left" : "right"}>
                  <div className={cn("rounded-xl px-6 py-5", i === 0 ? ts.cardBg : ts.accentLight)}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? ts.accent : ts.accent + "80" }} />
                      <div className={cn("text-sm font-bold", ts.titleColor)}>{colTitle}</div>
                    </div>
                    {colItems.map((item: string, j: number) => (
                      <div key={j} className={cn("text-sm flex items-start gap-2 mb-2 last:mb-0", ts.bodyColor)}>
                        <span className="mt-0.5 shrink-0" style={{ color: ts.accent }}>•</span>
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      )}

      {/* IMAGE FOCUSED */}
      {isImageFocused && (
        <div className="flex-1 flex flex-col justify-center items-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="scale"><div className={cn("text-2xl font-bold mb-4 text-center", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.1} variant="up">
            <div className={cn("rounded-2xl overflow-hidden max-w-4xl w-full", ts.cardBg)}>
              {slide.imageUrl ? (
                <img src={slide.imageUrl} alt="" className="w-full h-64 object-cover" />
              ) : (
                <div className="w-full h-64 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ts.accent}20, ${ts.accent}40)` }}>
                  <span className={cn("text-lg", ts.mutedColor)}>Add an image</span>
                </div>
              )}
              {slide.content.length > 0 && (
                <div className="px-6 py-4">
                  <div className={cn("text-sm text-center", ts.bodyColor)}>{slide.content[0]}</div>
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      )}

      {/* NUMBERED STEPS */}
      {isNumberedSteps && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="up"><div className={cn("text-2xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          <div className="space-y-3 max-w-4xl">
            {slide.content.slice(0, 6).map((point: string, i: number) => (
              <FadeIn key={i} delay={0.1 + i * 0.08} variant="left">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white" style={{ backgroundColor: ts.accent }}>
                    {i + 1}
                  </div>
                  <div className={cn("flex-1 rounded-xl px-5 py-3", ts.cardBg)}>
                    <div className={cn("text-sm leading-snug", ts.bodyColor)}>{point}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      )}

      {/* CLOSING */}
      {isClosing && (
        <div className={cn("flex-1 flex items-center justify-center px-16 relative", theme === "claude" && "bg-[#a8553a]", theme === "apple" && "bg-[#0066cc]", theme === "hp" && "bg-[#024ad8]", theme === "dark" && "bg-[#1a1a2e]", theme === "neon" && "bg-[#0a1628]", theme === "corporate" && "bg-[#1e293b]", (theme === "minimal" || theme === "nature" || theme === "gradient") && ts.stripBg)}>
          <div className="text-center relative z-10">
            <FadeIn variant="scale"><div className="text-5xl font-bold text-white mb-4">{slide.title}</div></FadeIn>
            {slide.content.length > 0 && (
              <FadeIn delay={0.15} variant="up"><div className="text-xl text-white/80">{slide.content[0]}</div></FadeIn>
            )}
            {slide.content.length > 1 && (
              <FadeIn delay={0.25} variant="up"><div className="text-base text-white/60 mt-3">{slide.content[1]}</div></FadeIn>
            )}
          </div>
        </div>
      )}

      {!isTitle && !isSection && !isStats && !isQuote && isTwoCol && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="up"><div className={cn("text-2xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          <div className="grid grid-cols-2 gap-4 max-w-4xl">
            {[0, 1].map(col => (
              <FadeIn key={col} delay={0.15 + col * 0.12} variant={col === 0 ? "left" : "right"}>
                <div className={cn("rounded-xl px-6 py-5", ts.cardBg)}>
                  <div className="w-6 h-1 rounded-full mb-4" style={{ backgroundColor: ts.accent }} />
                  <div className={cn("text-base leading-relaxed", theme === "claude" ? "text-white/90" : ts.bodyColor)}>
                    {(slide.content[col] || "").split("\n").map((line: string, li: number) => (
                      <div key={li} className="mb-2">{line}</div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      )}

      {!isTitle && !isSection && !isStats && !isQuote && !isTwoCol && (
        <div className="flex-1 flex flex-col justify-center px-16 pt-12 pb-4 relative z-10">
          <FadeIn variant="up"><div className={cn("text-2xl font-bold mb-3", ts.titleFont, ts.titleColor)}>{slide.title}</div></FadeIn>
          <FadeIn delay={0.05} variant="scale"><div className="h-px mb-6" style={{ backgroundColor: ts.accent }} /></FadeIn>
          {theme === "hp" && (
            <div className={cn("rounded-xl px-6 py-5 max-w-4xl", ts.cardBg)}>
              {slide.content.slice(0, 6).map((point: string, i: number) => (
                <FadeIn key={i} delay={0.1 + i * 0.07} variant="left">
                  <div className={cn("text-base flex items-start gap-2 mb-2 last:mb-0", ts.bodyColor)}>
                    <span style={{ color: ts.accent }} className="mt-1 shrink-0 text-lg">{"•"}</span>
                    <span className="leading-snug">{point}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
          {theme === "claude" && (
            <div className={cn("rounded-xl px-6 py-5 max-w-4xl", ts.cardBg)}>
              {slide.content.slice(0, 6).map((point: string, i: number) => (
                <FadeIn key={i} delay={0.1 + i * 0.07} variant="left">
                  <div className="text-base flex items-start gap-2 mb-2 last:mb-0 text-white/90">
                    <span className="text-[#cc785c] mt-1 shrink-0 text-lg">{"•"}</span>
                    <span className="leading-snug">{point}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
          {theme === "apple" && slide.content.slice(0, 6).map((point: string, i: number) => (
            <FadeIn key={i} delay={0.1 + i * 0.07} variant="left">
              <div className={cn("text-base flex items-start gap-2 mb-2 last:mb-0 max-w-4xl", ts.bodyColor)}>
                <span className="shrink-0 w-2 h-2 rounded-full mt-2" style={{ backgroundColor: ts.accent }} />
                <span className="leading-snug">{point}</span>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Layout-aware image positioning */}
      {slide.imageUrl && isTitle && (
        <div className="absolute inset-0 z-0">
          <ImageWithLoader src={slide.imageUrl} alt="" className="w-full h-full object-cover opacity-20" />
          <div className={cn("absolute inset-0", ts.bg, "opacity-80")} />
        </div>
      )}
      {slide.imageUrl && isSection && (
        <div className="absolute inset-0 z-0">
          <ImageWithLoader src={slide.imageUrl} alt="" className="w-full h-full object-cover opacity-25" />
        </div>
      )}
      {slide.imageUrl && isClosing && (
        <div className="absolute inset-0 z-0">
          <ImageWithLoader src={slide.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
        </div>
      )}
      {slide.imageUrl && !isTitle && !isSection && !isStats && !isQuote && !isTimeline && !isClosing && !isImageFocused && (
        <div className="absolute bottom-4 right-4 w-48 h-32 rounded-lg overflow-hidden shadow-md z-[1] opacity-80">
          <ImageWithLoader src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={cn("absolute bottom-0 left-0 right-0 px-8 py-3 flex items-center justify-between text-xs", ts.mutedColor, theme === "hp" && "bg-[#f0f4ff]")}>
        {showWatermark && <span className="font-medium">QuizFlow</span>}
        {!isTitle && <span>{slide.order + 1}</span>}
      </div>
    </div>
  )
}

export default function Presenter({ slides, title, theme, size = "16:9", showWatermark = true, onClose }: PresenterProps) {
  const [current, setCurrent] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [direction, setDirection] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false)
  const [autoTimer, setAutoTimer] = useState(5)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const ts = themes[theme] || themes.claude
  const sorted = [...slides].sort((a, b) => a.order - b.order)
  const total = sorted.length

  const sizeClasses = size === "4:3" ? "aspect-[4/3]" : size === "9:16" ? "aspect-[9/16] max-h-[80vh]" : "aspect-video"

  const goNext = useCallback(() => {
    if (current < total - 1) {
      setDirection(1)
      setCurrent(c => c + 1)
    } else {
      setAutoPlay(false)
    }
  }, [current, total])

  const goPrev = useCallback(() => {
    if (current > 0) {
      setDirection(-1)
      setCurrent(c => c - 1)
    }
  }, [current])

  const goTo = useCallback((idx: number) => {
    setDirection(idx > current ? 1 : -1)
    setCurrent(idx)
    setShowGrid(false)
  }, [current])

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    if (!autoPlay) { if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current); return }
    autoPlayTimer.current = setTimeout(() => goNext(), autoTimer * 1000)
    return () => { if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current) }
  }, [autoPlay, current, autoTimer, goNext])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showGrid) { if (e.key === "Escape") setShowGrid(false); return }
      if (showHelp) { if (e.key === "Escape" || e.key === "?") setShowHelp(false); return }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); resetControlsTimer() }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); resetControlsTimer() }
      else if (e.key === "Escape") { onClose() }
      else if (e.key === "Home") { setDirection(-1); setCurrent(0); resetControlsTimer() }
      else if (e.key === "End") { setDirection(1); setCurrent(total - 1); resetControlsTimer() }
      else if (e.key === "g") { setShowGrid(g => !g); resetControlsTimer() }
      else if (e.key === "?") { setShowHelp(h => !h); resetControlsTimer() }
      else if (e.key === "f" || e.key === "F") { setAutoPlay(a => !a); resetControlsTimer() }
      else if (e.key === "n" || e.key === "N") { setShowSpeakerNotes(s => !s); resetControlsTimer() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [goNext, goPrev, onClose, total, resetControlsTimer, showGrid, showHelp])

  useEffect(() => {
    resetControlsTimer()
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current) }
  }, [current, resetControlsTimer])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext()
      else goPrev()
    }
    touchStart.current = null
  }

  const currentSlide = sorted[current]
  const variants = getTransitionVariant(currentSlide?.layout || "titleContent", direction)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onMouseMove={resetControlsTimer}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Vignette overlay */}
      <div className="absolute inset-0 z-[90] pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)" }} />

      {/* Top progress bar */}
      <div className="absolute top-0 left-0 right-0 z-[110] h-1 bg-white/10">
        <motion.div
          className="h-full bg-white/90 rounded-r-full"
          initial={false}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ boxShadow: "0 0 12px rgba(255,255,255,0.4), 0 0 4px rgba(255,255,255,0.6)" }}
        />
      </div>

      {/* Slide area with side padding for arrows */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex">
          {/* Left arrow zone */}
          <button
            onClick={goPrev}
            className={cn(
              "w-16 flex items-center justify-center shrink-0 transition-all duration-300 z-[105]",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none",
              current === 0 && "pointer-events-none"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200 hover:scale-110 backdrop-blur-sm">
              <ChevronLeft size={24} />
            </div>
          </button>

          {/* Slide content */}
          <div className="flex-1 min-w-0 flex items-center justify-center p-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.9 }}
                className={cn("w-full h-full", sizeClasses)}
              >
                <SlideRenderer slide={sorted[current]} ts={ts} theme={theme} showWatermark={showWatermark} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right arrow zone */}
          <button
            onClick={goNext}
            className={cn(
              "w-16 flex items-center justify-center shrink-0 transition-all duration-300 z-[105]",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none",
              current === total - 1 && "pointer-events-none"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200 hover:scale-110 backdrop-blur-sm">
              <ChevronRight size={24} />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom controls bar — NOT absolute, takes its own space */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-between px-6 py-3 transition-all duration-300 z-[110] border-t border-white/5",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "rgba(0,0,0,0.9)" }}
      >
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all duration-200 hover:scale-110" title="Close (Esc)">
            <X size={20} />
          </button>
          <button onClick={() => setShowGrid(g => !g)} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110", showGrid ? "bg-white/30" : "bg-white/10 hover:bg-white/25")} title="Grid view (G)">
            <Grid3x3 size={18} />
          </button>
          <button onClick={() => setAutoPlay(a => !a)} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110", autoPlay ? "bg-brand-green/80" : "bg-white/10 hover:bg-white/25")} title="Auto-play (F)">
            <motion.div animate={autoPlay ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
              {autoPlay ? <Pause size={18} /> : <Play size={18} />}
            </motion.div>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={goPrev} disabled={current === 0} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110", current === 0 ? "bg-white/5 text-white/40" : "bg-white/10 hover:bg-white/25")}>
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-3">
            <motion.span
              key={current}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-white/80 text-sm font-medium tabular-nums"
            >{current + 1} / {total}</motion.span>
            <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={false}
                animate={{ width: `${((current + 1) / total) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>
          </div>

          <button onClick={goNext} disabled={current === total - 1} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110", current === total - 1 ? "bg-white/5 text-white/40" : "bg-white/10 hover:bg-white/25")}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {autoPlay && (
            <div className="flex items-center gap-1.5 mr-2">
              {[3, 5, 8, 12].map(s => (
                <button key={s} onClick={() => setAutoTimer(s)} className={cn("w-7 h-7 rounded-lg text-[11px] font-medium transition-all duration-200", autoTimer === s ? "bg-white/30 text-white" : "bg-white/10 text-white/50 hover:text-white hover:bg-white/20")}>
                  {s}s
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowSpeakerNotes(s => !s)} className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all duration-200", showSpeakerNotes ? "bg-white/30" : "bg-white/10 hover:bg-white/25")} title="Speaker notes (N)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6H3"/><path d="M21 12H3"/><path d="M15.5 18H3"/></svg>
          </button>
          <button onClick={() => setShowHelp(h => !h)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200" title="Help (?)">
            <HelpCircle size={16} />
          </button>
          <div className="text-white/50 text-xs max-w-[200px] truncate">{title}</div>
        </div>
      </div>

      {/* Grid view overlay */}
      <AnimatePresence>
        {showGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white/80 text-sm font-medium tracking-wide uppercase">All Slides</h3>
              <button onClick={() => setShowGrid(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 hover:scale-110">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {sorted.map((slide, idx) => (
                <motion.button
                  key={slide._id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => goTo(idx)}
                  className={cn(
                    "rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-105 hover:shadow-2xl relative group/card",
                    size === "4:3" ? "aspect-[4/3]" : size === "9:16" ? "aspect-[9/16]" : "aspect-video",
                    idx === current ? "border-brand-green shadow-lg shadow-brand-green/20 ring-2 ring-brand-green/30" : "border-white/15 hover:border-white/40"
                  )}
                >
                  <div className="w-full h-full relative">
                    <SlideRenderer slide={slide} ts={ts} theme={theme} showWatermark={false} />
                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-200" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                      <span className="text-white text-xs font-medium">{idx + 1}</span>
                      {slide.title && <span className="text-white/60 text-[10px] ml-2 truncate">{slide.title}</span>}
                    </div>
                    {idx === current && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-green flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">NOW</span>
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker Notes Panel */}
      <AnimatePresence>
        {showSpeakerNotes && currentSlide?.speakerNotes && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-16 left-0 right-0 z-[105] mx-16 mb-2"
          >
            <div className="bg-[#1a1a1a]/95 backdrop-blur-md rounded-xl px-6 py-4 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs font-medium uppercase tracking-wide">Speaker Notes</span>
                <button onClick={() => setShowSpeakerNotes(false)} className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                  <X size={10} />
                </button>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{currentSlide.speakerNotes}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
              <div className="space-y-2.5">
                {[
                  ["→ / Space", "Next slide"],
                  ["←", "Previous slide"],
                  ["Home / End", "First / Last slide"],
                  ["G", "Grid view"],
                  ["F", "Auto-play toggle"],
                  ["?", "Toggle this help"],
                  ["N", "Toggle speaker notes"],
                  ["Esc", "Exit presentation"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">{desc}</span>
                    <kbd className="bg-white/10 text-white/80 text-xs px-2.5 py-1 rounded-lg font-mono border border-white/5">{key}</kbd>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowHelp(false)} className="btn-primary w-full mt-5 !py-2.5">Got it</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
