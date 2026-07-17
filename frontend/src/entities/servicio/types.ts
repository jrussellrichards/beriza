// Tipos de la entidad Servicio — espejo de los schemas del backend

export type EstadoServicio = "ACTIVO" | "SUSPENDIDO" | "TERMINADO"

export interface Servicio {
  id: string
  nombre: string
  codigo_referencia: string | null
  estado: EstadoServicio
  fecha_inicio: string
  fecha_termino: string | null
  contratista_id: string
  contratista_razon_social: string
  contratista_rut: string
  perfil_nombre: string
  trabajadores_asignados: number
}

export interface Perfil {
  id: string
  mandante_id: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

// Estados de documento: 1=Enviado | 2=En Análisis | 3=Observado | 4=Aprobado | null=no subido
export interface RequisitoAvance {
  requisito_id: string
  requisito_codigo: string
  requisito_nombre: string
  entidad_tipo: "EMPRESA" | "TRABAJADOR"
  alcance: "ENTIDAD" | "SERVICIO"
  estado: number | null
  fecha_vigencia_hasta: string | null
  mensaje_brecha: string | null
  documento_id: string | null
  trabajador_id: string | null
  trabajador_nombre: string | null
}

export interface PilarAvance {
  codigo: string
  nombre: string
  total: number
  aprobados: number
  cumple: boolean
  requisitos: RequisitoAvance[]
}

export interface TrabajadorAvance {
  trabajador_id: string
  nombre: string
  rut: string
  cargo: string | null
  total: number
  aprobados: number
  cumple: boolean
}

export interface ResumenAvance {
  total_requisitos: number
  subidos: number
  aprobados: number
  observados: number
  en_analisis: number
  enviados: number
  faltantes: number
  porcentaje_avance: number
}

export interface AvanceServicio {
  servicio_id: string
  resumen: ResumenAvance
  pilares: PilarAvance[]
  trabajadores: TrabajadorAvance[]
}
