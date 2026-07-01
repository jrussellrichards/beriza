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

export interface EstadoAcreditacion {
  contratista_id: string
  mandante_id: string
  estado_global: "ACREDITADA" | "EN_PROCESO" | "BLOQUEADA"
  pilares_empresa: EstadoPilar[]
  trabajadores: EstadoTrabajador[]
}

export interface Documento {
  id: string
  requisito_id: string
  estado: 1 | 2 | 3 | 4
  mensaje_brecha: string | null
  campos_extraidos: Record<string, unknown> | null
  fecha_vigencia_hasta: string | null
  aprobado_por_excepcion: boolean
  created_at: string
}

export interface Trabajador {
  id: string
  rut: string
  nombre_completo: string
  cargo: string | null
  activo: boolean
}

export interface SubidaDocumentoResponse {
  documento_id: string
  mensaje: string
}
