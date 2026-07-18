"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown } from "lucide-react"

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ")
}

function useClickAway(ref: React.RefObject<HTMLElement | null>, handler: (event: MouseEvent | TouchEvent) => void) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      handler(event)
    }
    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)
    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}

export interface FluidDropdownItem {
  id: string
  label: string
  icon: React.ElementType
  color: string
}

interface FluidDropdownProps {
  items: FluidDropdownItem[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

function IconWrapper({ icon: Icon, isHovered }: { icon: React.ElementType; isHovered: boolean }) {
  return (
    <motion.div
      className="w-4 h-4 mr-2 relative shrink-0"
      initial={false}
      animate={isHovered ? { scale: 1.15 } : { scale: 1 }}
    >
      <Icon className="w-4 h-4" />
    </motion.div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: "beforeChildren", staggerChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

const ITEM_HEIGHT = 36
const PADDING_TOP = 4

export function FluidDropdown({ items, selectedId, onSelect, className }: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const selected = items.find((i) => i.id === selectedId) ?? items[0]

  useClickAway(dropdownRef, () => setIsOpen(false))

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full relative", className)} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "inline-flex items-center justify-between w-full h-10",
            "rounded-lg border border-hairline bg-canvas px-3 py-2",
            "text-body-sm text-ink",
            "transition-all duration-150",
            "hover:bg-surface",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
            isOpen && "border-brand-green/50 bg-surface",
          )}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="flex items-center min-w-0">
            <IconWrapper icon={selected.icon} isHovered={false} />
            <span className="truncate">{selected.label}</span>
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center w-5 h-5 shrink-0 text-steel"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 1, y: 0, height: 0 }}
              animate={{
                opacity: 1, y: 0, height: "auto",
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              exit={{
                opacity: 0, y: 0, height: 0,
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              className="absolute left-0 right-0 top-full mt-1.5 z-50"
            >
              <motion.div
                className="w-full rounded-xl border border-hairline bg-surface p-1 shadow-lg"
                initial={{ borderRadius: 8 }}
                animate={{ borderRadius: 12, transition: { duration: 0.15 } }}
              >
                <motion.div
                  className="py-1 relative"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    layoutId="dropdown-highlight"
                    className="absolute left-1 right-1 rounded-lg"
                    animate={{
                      y: items.findIndex((i) => (hoveredId || selectedId) === i.id) * ITEM_HEIGHT + PADDING_TOP,
                      height: ITEM_HEIGHT,
                    }}
                    transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                    style={{ backgroundColor: "rgb(var(--color-hairline) / 0.5)" }}
                  />
                  {items.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => { onSelect(item.id); setIsOpen(false) }}
                      onHoverStart={() => setHoveredId(item.id)}
                      onHoverEnd={() => setHoveredId(null)}
                      className={cn(
                        "relative flex w-full items-center px-3 py-[7px] text-body-sm rounded-lg",
                        "transition-colors duration-150 focus:outline-none",
                        (selectedId === item.id || hoveredId === item.id)
                          ? "text-ink" : "text-steel",
                      )}
                      whileTap={{ scale: 0.98 }}
                      variants={itemVariants}
                    >
                      <IconWrapper icon={item.icon} isHovered={hoveredId === item.id} />
                      <span className="truncate">{item.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
