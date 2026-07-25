"use client"

import { CheckCircle, XCircle, AlertCircle, Upload } from "lucide-react"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import type { EstadoPilar } from "@/shared/types"

interface Props {
  pilar: EstadoPilar
  onSubirDocumento?: () => void
}

export function PilarCard({ pilar, onSubirDocumento }: Props) {
  return (
    <Card className={pilar.cumple ? "border-ok-line" : "border-bloqueo-line"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-ink-secondary">
            {pilar.pilar_nombre}
          </CardTitle>
          {pilar.cumple ? (
            <CheckCircle size={18} className="text-ok-ink" />
          ) : (
            <XCircle size={18} className="text-bloqueo-ink" />
          )}
        </div>
        <Badge
          variant={pilar.cumple ? "default" : "destructive"}
          className={pilar.cumple ? "bg-ok-soft text-ok-ink hover:bg-ok-soft w-fit" : "w-fit"}
        >
          {pilar.cumple ? "Cumple" : "No cumple"}
        </Badge>
      </CardHeader>
      {(!pilar.cumple && pilar.brechas.length > 0) && (
        <CardContent className="pt-0 space-y-3">
          <ul className="space-y-1.5">
            {pilar.brechas.map((brecha, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-ink-muted">
                <AlertCircle size={13} className="text-accion-ink mt-0.5 shrink-0" />
                {brecha}
              </li>
            ))}
          </ul>
          {onSubirDocumento && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={onSubirDocumento}>
              <Upload size={13} />
              Subir documento
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
