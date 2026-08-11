import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-surface-inverse text-white hover:bg-surface-inverse/90",
        destructive:
          "bg-bloqueo-ink text-white hover:bg-bloqueo-ink/90",
        outline:
          "border border-line border-line bg-surface hover:bg-surface-app hover:text-ink",
        secondary:
          "bg-surface-app text-ink-secondary hover:bg-surface-app/80",
        ghost: "hover:bg-surface-app hover:text-ink",
        link: "text-brand underline-offset-4 hover:underline",
      },
      // En telefono todos los tamaños suben a 44 px de alto, que es el minimo
      // comodo para un dedo —y el usuario tipico del portal del contratista esta
      // en faena, con el telefono en una mano y a veces con guantes—. Desde `sm`
      // vuelven a su altura original, que es la que pide el diseño denso de
      // escritorio. Se corrige acá y no pantalla por pantalla para que valga en
      // todas de una vez.
      size: {
        default: "min-h-11 h-11 sm:min-h-10 sm:h-10 px-4 py-2",
        sm: "min-h-11 h-11 sm:min-h-9 sm:h-9 rounded-md px-3",
        lg: "min-h-11 h-11 rounded-md px-8",
        icon: "min-h-11 h-11 w-11 sm:min-h-10 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
