"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Claro fijo, no "system". El modo oscuro se descartó a propósito para
      // este producto: medido, aguanta menos luz ambiente que el claro, y sus
      // usuarios trabajan a pleno sol. Al no consultar el tema del sistema se
      // cae ademas una dependencia que no usaba nadie mas.
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:border-border border-line group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-ink-muted",
          actionButton:
            "group-[.toast]:bg-surface-inverse group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-surface-sunken group-[.toast]:text-ink-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
