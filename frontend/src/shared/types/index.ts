export type Rol = "berisa_admin" | "mandante_admin" | "contratista_admin" | "prevencionista"

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: Rol
  mandante_id: string | null
  contratista_id: string | null
}

export interface EstadoPilar {
  pilar_codigo: string
  pilar_nombre: string
  cumple: boolean
  brechas: string[]
}

export interface EstadoTrabajador {
  trabajador_id: string
  nombre: string
  rut: string
  cumple: boolean
  pilares: EstadoPilar[]
}

// PENDIENTE = la relación no tiene servicios activos (nada exigible aún)
export type EstadoGlobal = "PENDIENTE" | "EN_PROCESO" | "ACREDITADA" | "BLOQUEADA"

export interface EstadoAcreditacion {
  contratista_id: string
  mandante_id: string
  estado_global: EstadoGlobal
  pilares_empresa: EstadoPilar[]
  trabajadores: EstadoTrabajador[]
}

export interface Trabajador {
  id: string
  rut: string
  nombre_completo: string
  cargo: string | null
  activo: boolean
}
