/**
 * ═══════════════════════════════════════════════════════
 * BERISA — Data Module v1.0
 * Catálogo de Proyectos & Datos de Referencia
 * Información genérica — reemplazar con datos reales
 * ═══════════════════════════════════════════════════════
 */
;(function(global) {
  'use strict';

  /* ─── SECTOR COLORS ─────────────────────────────────────── */
  const SCOL = {
    "Energía":          "#F59E0B",
    "Infraestructura":  "#3B82F6",
    "Minería":          "#8B5CF6",
    "Inmobiliario":     "#10B981",
    "Industrial":       "#F97316",
    "Agua y Sanitaria": "#06B6D4",
    "Transporte":       "#EC4899",
    "Concesiones":      "#84CC16",
    "Salud":            "#EF4444",
    "Educación":        "#6366F1",
  };

  /* ─── STATUS DOT CLASSES ─────────────────────────────────── */
  const SDOT = {
    "En licitación": "g",
    "Ejecución":     "g",
    "Prefactibilidad":"y",
    "Factibilidad":  "y",
    "En diseño":     "y",
    "Terminado":     "gr",
    "Suspendido":    "o",
    "Cancelado":     "gr",
  };

  /* ─── CHART COLOR PALETTE ─────────────────────────────────── */
  const CCOL = [
    "#C9972B","#3B82F6","#10B981","#F59E0B",
    "#8B5CF6","#EC4899","#06B6D4","#84CC16",
    "#F97316","#6366F1","#EF4444","#14B8A6",
  ];

  /* ─── REGION ORDERING (Chile) ────────────────────────────── */
  const RNS = [
    "Arica y Parinacota","Tarapacá","Antofagasta","Atacama","Coquimbo",
    "Valparaíso","Metropolitana","O'Higgins","Maule","Ñuble","Biobío",
    "La Araucanía","Los Ríos","Los Lagos","Aysén","Magallanes",
  ];

  /* ─── REGION SHORT NAMES ─────────────────────────────────── */
  const RSH = {
    "Arica y Parinacota": "Arica",
    "Tarapacá":           "Tarapacá",
    "Antofagasta":        "Antofagasta",
    "Atacama":            "Atacama",
    "Coquimbo":           "Coquimbo",
    "Valparaíso":         "Valparaíso",
    "Metropolitana":      "R.M.",
    "O'Higgins":          "O'Higgins",
    "Maule":              "Maule",
    "Ñuble":              "Ñuble",
    "Biobío":             "Biobío",
    "La Araucanía":       "Araucanía",
    "Los Ríos":           "Los Ríos",
    "Los Lagos":          "Los Lagos",
    "Aysén":              "Aysén",
    "Magallanes":         "Magallanes",
  };

  /* ─── CONTACT CATEGORY COLORS & ICONS ───────────────────── */
  const CAT_COL = {
    "Decisor":     "#C9972B",
    "Influencer":  "#3B82F6",
    "Técnico":     "#10B981",
    "Ejecutivo":   "#8B5CF6",
    "Contratista": "#F97316",
    "Consultor":   "#EC4899",
  };
  const CAT_ICO = {
    "Decisor":     "👔",
    "Influencer":  "🤝",
    "Técnico":     "⚙️",
    "Ejecutivo":   "🏢",
    "Contratista": "🏗️",
    "Consultor":   "📋",
  };
  const CAT_ORD = ["Decisor","Ejecutivo","Influencer","Técnico","Contratista","Consultor"];

  /* ─── CONTACT TAG METADATA ─────────────────────────────── */
  const TAG_META = {
    "clave":      { l:"Clave",      i:"⭐", d:"Contacto clave estratégico" },
    "decision":   { l:"Decisor",    i:"🎯", d:"Tomador de decisión principal" },
    "tecnico":    { l:"Técnico",    i:"⚙️",  d:"Especialista técnico" },
    "ejecutivo":  { l:"Ejecutivo",  i:"🏢", d:"Nivel ejecutivo" },
  };
  const TAG_RANK = { "decision":0, "clave":1, "ejecutivo":2, "tecnico":3 };

  /* ─── ORGANIZATION DATABASE ──────────────────────────────── */
  const ORG_DB = {
    "codelco": {
      company: "Codelco",
      source_name: "Codelco", source_url: "https://www.codelco.com",
      aliases: ["Corporación Nacional del Cobre","CODELCO","Codelco Chile"],
      level1_title: "Directorio",
      level1: [{ name:"Máximo Pacheco", role:"Presidente Directorio" }],
      level2_title: "Gerencia General",
      level2: [{ name:"Ruben Alvarado", role:"Presidente Ejecutivo" }],
    },
    "enap": {
      company: "ENAP",
      source_name: "ENAP", source_url: "https://www.enap.cl",
      aliases: ["Empresa Nacional del Petróleo","ENAP","Enap Refinerías"],
      level1_title: "Directorio",
      level1: [{ name:"Directorio ENAP", role:"Presidente" }],
      level2_title: "Gerencia",
      level2: [{ name:"Gerente General", role:"CEO" }],
    },
    "mop": {
      company: "Ministerio de Obras Públicas",
      source_name: "MOP", source_url: "https://www.mop.cl",
      aliases: ["MOP","Ministerio de Obras Públicas","Vialidad","DGOP"],
      level1_title: "Ministro",
      level1: [{ name:"Ministro MOP", role:"Ministro de Obras Públicas" }],
      level2_title: "Subsecretaría",
      level2: [{ name:"Subsecretario", role:"Subsecretario de Obras Públicas" }],
    },
    "arauco": {
      company: "Celulosa Arauco",
      source_name: "Arauco", source_url: "https://www.arauco.cl",
      aliases: ["Arauco","Celulosa Arauco","Forestal Arauco","CMPC Arauco"],
      level1_title: "CEO",
      level1: [{ name:"CEO Arauco", role:"Presidente Ejecutivo" }],
      level2_title: "Gerencia",
      level2: [{ name:"Gerente de Proyectos", role:"VP Proyectos e Ingeniería" }],
    },
  };

  /* ─── PROJECT CATALOGUE ──────────────────────────────────── */
  /* 
   * Datos de referencia del mercado de infraestructura.
   * Fuente: Información pública y de mercado.
   * Reemplazar o complementar con datos propietarios.
   */
  const PROJECTS = [
    {
      id:1, n:"Planta Solar Atacama Norte", s:"Energía", st:"En licitación",
      c:"Chile", region:"Antofagasta", creg:"Antofagasta",
      loc:"Ruta 26, Km 45, Antofagasta", inv:480, ini:"2026-03", fin:"2028-06",
      tip:"Fotovoltaica + BESS · 300 MW",
      own:"Empresa Energías Renovables S.A.", score:5, opp:"green", opp_lbl:"Q1 2026 — Licitación abierta",
      lat:-24.1, lon:-70.4,
      desc:"Proyecto de generación solar fotovoltaica con almacenamiento en baterías en la Región de Antofagasta. Incluye línea de transmisión de 85 km.",
      cts:[
        { nombre:"Carlos Fuentes V.", cargo:"Gerente de Proyectos", empresa:"Empresa Energías Renovables S.A.", cat:"Decisor", tag:"decision", email:"c.fuentes@energias.cl", tel:"+56 2 2123 4567" },
        { nombre:"Ing. Ana Torres", cargo:"Jefa de Ingeniería", empresa:"Empresa Energías Renovables S.A.", cat:"Técnico", tag:"tecnico", email:"a.torres@energias.cl", tel:null },
      ],
    },
    {
      id:2, n:"Autopista Costanera Bío-Bío", s:"Infraestructura", st:"Factibilidad",
      c:"Chile", region:"Biobío", creg:"Biobío",
      loc:"Concepción - Talcahuano, Región del Biobío", inv:1200, ini:"2027-01", fin:"2030-12",
      tip:"Autopista urbana · 34 km concesión",
      own:"Ministerio de Obras Públicas", score:5, opp:"green", opp_lbl:"Q2 2026 — Precalificación",
      lat:-36.8, lon:-73.0,
      desc:"Concesión vial que conecta Concepción con Talcahuano a través de un corredor costero. Incluye 3 intercambiadores y 1 puente sobre el río Biobío.",
      cts:[
        { nombre:"Pedro Morales", cargo:"Director de Concesiones", empresa:"Ministerio de Obras Públicas", cat:"Decisor", tag:"decision", email:"p.morales@mop.cl", tel:"+56 2 2449 4000" },
        { nombre:"Rodrigo Espinoza", cargo:"Jefe de Proyectos Viales", empresa:"Ministerio de Obras Públicas", cat:"Técnico", tag:"tecnico", email:"r.espinoza@mop.cl", tel:null },
      ],
    },
    {
      id:3, n:"Expansión Puerto San Antonio — Terminal Norte", s:"Infraestructura", st:"Ejecución",
      c:"Chile", region:"Valparaíso", creg:"Valparaíso",
      loc:"Puerto San Antonio, V Región", inv:780, ini:"2025-06", fin:"2028-03",
      tip:"Terminal portuario · capacidad 2M TEU",
      own:"Empresa Portuaria San Antonio", score:4, opp:"yellow", opp_lbl:"Q3 2026 — Partidas secundarias",
      lat:-33.6, lon:-71.6,
      desc:"Expansión del terminal norte del puerto incluyendo 2 nuevos sitios de atraque para buques portacontenedores de última generación.",
      cts:[
        { nombre:"Jorge Herrera", cargo:"Gerente de Infraestructura", empresa:"Empresa Portuaria San Antonio", cat:"Decisor", tag:"decision", email:"j.herrera@puertosa.cl", tel:"+56 35 222 3000" },
      ],
    },
    {
      id:4, n:"Proyecto MAPA — Planta Arauco", s:"Industrial", st:"Ejecución",
      c:"Chile", region:"Biobío", creg:"Biobío",
      loc:"Planta Arauco, Arauco, Biobío", inv:2700, ini:"2024-01", fin:"2027-06",
      tip:"Celulosa · Planta kraft 1.5 M ton/año",
      own:"Celulosa Arauco", score:5, opp:"green", opp_lbl:"Q1 2026 — Subcontratos activos",
      lat:-37.2, lon:-73.3,
      desc:"Modernización y Ampliación de la Planta Arauco (MAPA). Planta kraft de última generación con capacidad de 1,56 millones de toneladas anuales de celulosa de eucaliptus.",
      cts:[
        { nombre:"Mauricio Silva", cargo:"VP Proyectos e Ingeniería", empresa:"Celulosa Arauco", cat:"Decisor", tag:"decision", email:"m.silva@arauco.cl", tel:"+56 2 2461 7200" },
        { nombre:"Daniela Reyes", cargo:"Gerente Contratos", empresa:"Celulosa Arauco", cat:"Influencer", tag:"clave", email:"d.reyes@arauco.cl", tel:"+56 2 2461 7300" },
      ],
    },
    {
      id:5, n:"Hospital Regional Rancagua — Fase II", s:"Salud", st:"En licitación",
      c:"Chile", region:"O'Higgins", creg:"O'Higgins",
      loc:"Av. Libertador, Rancagua", inv:320, ini:"2026-07", fin:"2029-12",
      tip:"Hospital público · 600 camas",
      own:"Ministerio de Salud", score:4, opp:"green", opp_lbl:"Q2 2026 — Apertura propuestas",
      lat:-34.1, lon:-70.7,
      desc:"Segunda fase del nuevo Hospital Regional de Rancagua, incluyendo pabellones de alta complejidad, UCI y servicios de emergencia.",
      cts:[
        { nombre:"Dra. Patricia Vega", cargo:"Directora Proyectos Salud", empresa:"Ministerio de Salud", cat:"Decisor", tag:"decision", email:"p.vega@minsal.cl", tel:"+56 2 2574 0100" },
      ],
    },
    {
      id:6, n:"Línea 9 Metro Santiago — Tramo Nor-Oriente", s:"Transporte", st:"Prefactibilidad",
      c:"Chile", region:"Metropolitana", creg:"Metropolitana",
      loc:"Comunas de Peñalolén, La Florida y Macul, Santiago", inv:3500, ini:"2028-01", fin:"2033-12",
      tip:"Metro subterráneo · 18 km · 14 estaciones",
      own:"Metro de Santiago", score:5, opp:"yellow", opp_lbl:"Q4 2026 — Llamado a precalificación",
      lat:-33.5, lon:-70.58,
      desc:"Nueva línea de metro que conectará las comunas del sector nor-oriente de Santiago con el centro de la ciudad, aliviando la saturación de las líneas 4 y 5.",
      cts:[
        { nombre:"Héctor Muñoz", cargo:"Gerente de Proyectos Nuevas Líneas", empresa:"Metro de Santiago", cat:"Decisor", tag:"decision", email:"h.munoz@metrosantiago.cl", tel:"+56 2 2937 5000" },
        { nombre:"Valentina Pizarro", cargo:"Subgerente Ingeniería Civil", empresa:"Metro de Santiago", cat:"Técnico", tag:"tecnico", email:"v.pizarro@metrosantiago.cl", tel:null },
      ],
    },
    {
      id:7, n:"Parque Eólico Aysén — Fase 1", s:"Energía", st:"Prefactibilidad",
      c:"Chile", region:"Aysén", creg:"Aysén",
      loc:"Lago General Carrera, XI Región", inv:890, ini:"2028-06", fin:"2031-12",
      tip:"Eólico · 400 MW · Exportación HVDC",
      own:"Empresa Energía Austral S.A.", score:3, opp:"yellow", opp_lbl:"H1 2027 — Permisos ambientales",
      lat:-46.5, lon:-72.1,
      desc:"Parque eólico de gran escala en la Patagonia chilena con línea de transmisión HVDC para exportación al Sistema Eléctrico Nacional.",
      cts:[],
    },
    {
      id:8, n:"Embalse Las Palmas — Sistema de Riego", s:"Agua y Sanitaria", st:"Factibilidad",
      c:"Chile", region:"Coquimbo", creg:"Coquimbo",
      loc:"Cuenca Río Choapa, Illapel", inv:560, ini:"2027-03", fin:"2030-09",
      tip:"Embalse · 200 Mm³ · 15.000 há riego",
      own:"Ministerio de Obras Públicas", score:4, opp:"yellow", opp_lbl:"Q3 2026 — Estudio definitivo",
      lat:-31.6, lon:-71.2,
      desc:"Embalse multipropósito que incluye irrigación de 15.000 hectáreas agrícolas y suministro de agua potable a la provincia de Choapa.",
      cts:[
        { nombre:"Luis Moraga", cargo:"Director Regional MOP Coquimbo", empresa:"Ministerio de Obras Públicas", cat:"Decisor", tag:"decision", email:"l.moraga@mop.cl", tel:"+56 53 2 213 200" },
      ],
    },
    {
      id:9, n:"Terminal GNL Mejillones — Expansión", s:"Energía", st:"En diseño",
      c:"Chile", region:"Antofagasta", creg:"Antofagasta",
      loc:"Bahía de Mejillones, Antofagasta", inv:430, ini:"2027-01", fin:"2029-06",
      tip:"GNL · 2da regasificadora · 4 MMCMD",
      own:"GNL Mejillones S.A.", score:4, opp:"yellow", opp_lbl:"Q4 2026 — Ingeniería básica",
      lat:-23.1, lon:-70.45,
      desc:"Expansión del terminal GNL Mejillones con una segunda unidad de regasificación para abastecer la demanda del norte del país.",
      cts:[
        { nombre:"Roberto Contreras", cargo:"Gerente de Desarrollo", empresa:"GNL Mejillones S.A.", cat:"Decisor", tag:"decision", email:"r.contreras@gnlmejillones.cl", tel:null },
      ],
    },
    {
      id:10, n:"Centro Urbano Costanera Norte — Edificio Corporativo", s:"Inmobiliario", st:"En licitación",
      c:"Chile", region:"Metropolitana", creg:"Metropolitana",
      loc:"Av. Costanera Norte 1700, Providencia, Santiago", inv:185, ini:"2026-04", fin:"2028-09",
      tip:"Oficinas clase A · 45.000 m² · LEED Gold",
      own:"Inmobiliaria Costanera Norte S.A.", score:3, opp:"green", opp_lbl:"Q1 2026 — Propuestas abiertas",
      lat:-33.42, lon:-70.62,
      desc:"Torre de oficinas clase A+ con certificación LEED Gold, en el sector de El Salto, Providencia. Incluye pisos de trading y salas de reuniones de última generación.",
      cts:[
        { nombre:"Felipe Alarcón", cargo:"Gerente de Proyectos", empresa:"Inmobiliaria Costanera Norte S.A.", cat:"Decisor", tag:"decision", email:"f.alarcon@costaneranorte.cl", tel:"+56 2 2380 4000" },
      ],
    },
    {
      id:11, n:"Planta Desaladora Tarapacá", s:"Agua y Sanitaria", st:"Ejecución",
      c:"Chile", region:"Tarapacá", creg:"Tarapacá",
      loc:"Costa de Iquique, Tarapacá", inv:310, ini:"2025-01", fin:"2027-06",
      tip:"Desalación SWRO · 1.200 l/s",
      own:"Aguas del Norte S.A.", score:4, opp:"yellow", opp_lbl:"Q2 2026 — Partidas electromecánicas",
      lat:-20.21, lon:-70.14,
      desc:"Planta desaladora de osmosis inversa con capacidad de 1.200 l/s para abastecimiento minero e industrial en la Región de Tarapacá.",
      cts:[],
    },
    {
      id:12, n:"Ruta CH-60 — Paso Pehuenche Mejoramiento", s:"Infraestructura", st:"En diseño",
      c:"Chile", region:"Maule", creg:"Maule",
      loc:"Ruta CH-60, Región del Maule", inv:240, ini:"2027-06", fin:"2030-03",
      tip:"Mejoramiento ruta internacional · 85 km",
      own:"Ministerio de Obras Públicas", score:3, opp:"yellow", opp_lbl:"H2 2026 — Diseño definitivo",
      lat:-35.8, lon:-70.9,
      desc:"Mejoramiento del Paso Internacional Pehuenche con ensanche de calzada, obras de arte y señalización internacional.",
      cts:[],
    },
    {
      id:13, n:"Estadio Regional Temuco — Renovación", s:"Inmobiliario", st:"Prefactibilidad",
      c:"Chile", region:"La Araucanía", creg:"La Araucanía",
      loc:"Av. Caupolicán, Temuco", inv:95, ini:"2027-09", fin:"2029-03",
      tip:"Estadio multiuso · 20.000 espectadores",
      own:"Ministerio del Deporte", score:2, opp:"red", opp_lbl:"2027 — Presupuesto pendiente",
      lat:-38.74, lon:-72.58,
      desc:"Renovación integral del Estadio Regional de Temuco para convertirlo en recinto multiuso con capacidad para 20.000 espectadores y normativa FIFA.",
      cts:[],
    },
    {
      id:14, n:"Proyecto Minero Quebrada Blanca — Fase 3", s:"Minería", st:"Prefactibilidad",
      c:"Chile", region:"Tarapacá", creg:"Tarapacá",
      loc:"Alto Tarapacá, I Región", inv:4200, ini:"2029-01", fin:"2034-12",
      tip:"Minería de cobre · 300 kt/año · Open pit",
      own:"Teck Resources Limited", score:5, opp:"yellow", opp_lbl:"2027 — Estudio factibilidad",
      lat:-20.9, lon:-68.8,
      desc:"Tercera fase de expansión de la mina Quebrada Blanca con nuevo open pit y planta concentradora para 300.000 toneladas de cobre fino anuales.",
      cts:[
        { nombre:"Andrés Vidal", cargo:"VP Desarrollo de Proyectos Sudamérica", empresa:"Teck Resources", cat:"Decisor", tag:"decision", email:"a.vidal@teck.com", tel:null },
      ],
    },
    {
      id:15, n:"Universidad Técnica — Campus STEM Valparaíso", s:"Educación", st:"En licitación",
      c:"Chile", region:"Valparaíso", creg:"Valparaíso",
      loc:"Av. España 1680, Valparaíso", inv:145, ini:"2026-08", fin:"2029-06",
      tip:"Campus universitario · 25.000 m² STEM",
      own:"Universidad Técnica Federico Santa María", score:3, opp:"green", opp_lbl:"Q2 2026 — Llamado próximo",
      lat:-33.02, lon:-71.55,
      desc:"Nuevo campus de ciencias e ingenierías de la USM con laboratorios de última generación, talleres de fabricación digital y centro de innovación.",
      cts:[
        { nombre:"Dr. Marco Rendić", cargo:"Rector USM", empresa:"Universidad Técnica Federico Santa María", cat:"Ejecutivo", tag:"ejecutivo", email:"rector@usm.cl", tel:"+56 32 265 4800" },
      ],
    },
    {
      id:16, n:"Corredor Bioceánico — Ruta Los Lagos", s:"Transporte", st:"Factibilidad",
      c:"Chile", region:"Los Lagos", creg:"Los Lagos",
      loc:"Puerto Montt — Paso Cardenal Samoré", inv:620, ini:"2028-01", fin:"2032-06",
      tip:"Corredor vial internacional · 180 km",
      own:"Ministerio de Obras Públicas", score:4, opp:"yellow", opp_lbl:"Q4 2026 — BID financiamiento",
      lat:-41.5, lon:-72.5,
      desc:"Mejoramiento del Corredor Bioceánico en la Región de Los Lagos, facilitando el transporte de carga entre el Pacífico y el Atlántico.",
      cts:[],
    },
    {
      id:17, n:"Parque Fotovoltaico Los Llanos", s:"Energía", st:"Ejecución",
      c:"Argentina", creg:"Mendoza",
      loc:"Los Llanos, Rivadavia, Mendoza, Argentina", inv:290, ini:"2025-03", fin:"2026-09",
      tip:"FV · 150 MW · Mercado MATER",
      own:"YPF Luz S.A.", score:3, opp:"yellow", opp_lbl:"Q2 2026 — Obra civil avanzada",
      lat:-34.2, lon:-67.8,
      desc:"Parque solar fotovoltaico de 150 MW en Mendoza, conectado al SADI con contratos de venta al Mercado a Término de Energías Renovables (MATER).",
      cts:[],
    },
    {
      id:18, n:"Proyecto Especial Ruta Minera Antapaccay", s:"Minería", st:"En diseño",
      c:"Perú", creg:"Cusco",
      loc:"Espinar, Cusco, Perú", inv:1100, ini:"2027-06", fin:"2030-12",
      tip:"Ruta minera + infraestructura soporte",
      own:"Glencore Antapaccay", score:4, opp:"yellow", opp_lbl:"Q3 2026 — Ing. básica",
      lat:-14.8, lon:-71.3,
      desc:"Habilitación de ruta minera de 65 km para transporte concentrado de cobre desde la mina Antapaccay hacia el puerto de Matarani.",
      cts:[],
    },
    {
      id:19, n:"Represa El Tambolar", s:"Energía", st:"En licitación",
      c:"Argentina", creg:"San Juan",
      loc:"Cuenca Río San Juan, Argentina", inv:780, ini:"2026-06", fin:"2030-06",
      tip:"Hidroeléctrica · 70 MW + riego 12.000 há",
      own:"Gobierno de San Juan", score:4, opp:"green", opp_lbl:"Q1 2026 — Licitación abierta",
      lat:-31.5, lon:-68.8,
      desc:"Represa multipropósito con generación eléctrica de 70 MW y riego de 12.000 hectáreas en el Valle de Ullum.",
      cts:[],
    },
    {
      id:20, n:"IIRSA Norte — Tramo Paita-Yurimaguas Fase II", s:"Transporte", st:"Prefactibilidad",
      c:"Perú", creg:"Piura",
      loc:"Paita — Yurimaguas, Piura-Loreto, Perú", inv:1800, ini:"2028-01", fin:"2033-06",
      tip:"Autopista · 955 km · Corredor bioceánico",
      own:"Provías Nacional MTC Perú", score:3, opp:"yellow", opp_lbl:"2027 — BID Prefactibilidad",
      lat:-8.0, lon:-76.0,
      desc:"Segunda fase del eje vial IIRSA Norte, completando la conectividad entre el Pacífico y la Amazonía peruana.",
      cts:[],
    },
  ];

  /* ─── CURRENCY SETTINGS ──────────────────────────────────── */
  const EUR_RATE = 0.95;  // USD → EUR (actualizar periódicamente)

  /* ─── LANGUAGE STRINGS ───────────────────────────────────── */
  const LANGS = {
    es: {
      na:"S/D", mc:"Mapa de Contactos", mnc:"Sin contactos registrados",
      mdi:"Información de referencia de mercado — clasificación interna de Berisa",
      morg:"Organizaciones Vinculadas", morg0:"Sin ficha",
      morg1:"Ficha registrada", morg2:"Fuente", morg3:"Ver LinkedIn",
      morg4:"Mandante / Titular", morg5:"Empresa vinculada",
      morg6:"Sin datos organizacionales registrados",
      morg7:"Nivel directivo", morg8:"Nivel gerencial",
      osc:"Sector", ost:"Estado", opais:"País", oreg:"Región",
      ownw0:"Buscar mandante…", ownw1:"Por CAPEX", ownw2:"Por N° proyectos",
      ownw3:"Filtrar", ownw4:"CAPEX", ownw5:"Proyectos", ownw6:"Mandante",
      ownw7:"Ficha", ownw8:"Registrado", ownw9:"Sin ficha",
      ownw10:"Limpiar filtro", ownw11:"Mandante",
    },
    en: {
      na:"N/A", mc:"Contact Map", mnc:"No contacts registered",
      mdi:"Market reference data — Berisa internal classification",
      morg:"Linked Organizations", morg0:"No record",
      morg1:"Record on file", morg2:"Source", morg3:"View LinkedIn",
      morg4:"Owner / Client", morg5:"Linked company",
      morg6:"No organizational data on record",
      morg7:"Board level", morg8:"Executive level",
      osc:"Sector", ost:"Status", opais:"Country", oreg:"Region",
      ownw0:"Search owner…", ownw1:"By CAPEX", ownw2:"By # projects",
      ownw3:"Filter", ownw4:"CAPEX", ownw5:"Projects", ownw6:"Owner",
      ownw7:"Record", ownw8:"On file", ownw9:"No record",
      ownw10:"Clear filter", ownw11:"Owner",
    },
  };

  /* ─── PIPELINE STAGES ─────────────────────────────────────── */
  const PIPELINE_STAGES = [
    { id:"prospecting", label:"Prospección",   color:"#64748B", prob:10 },
    { id:"qualifying",  label:"Calificación",  color:"#3B82F6", prob:25 },
    { id:"proposal",    label:"Propuesta",     color:"#C9972B", prob:50 },
    { id:"negotiation", label:"Negociación",   color:"#F59E0B", prob:75 },
    { id:"closing",     label:"Cierre",        color:"#10B981", prob:90 },
  ];

  /* ─── PIPELINE OPPORTUNITIES (sample) ────────────────────── */
  const PIPELINE_OPP = [
    { id:"opp_001", name:"Terminal GNL Mejillones Expansión", company:"GNL Mejillones S.A.", value:43, stage:"proposal", prob:55, dueDate:"2026-04-30", contact:"Roberto Contreras", sector:"Energía" },
    { id:"opp_002", name:"Hospital Regional Rancagua Fase II", company:"Ministerio de Salud", value:32, stage:"qualifying", prob:30, dueDate:"2026-06-30", contact:"Dra. Patricia Vega", sector:"Salud" },
    { id:"opp_003", name:"Expansión Puerto San Antonio", company:"EPSA", value:78, stage:"negotiation", prob:70, dueDate:"2026-05-15", contact:"Jorge Herrera", sector:"Infraestructura" },
    { id:"opp_004", name:"Autopista Costanera Bío-Bío", company:"MOP", value:120, stage:"prospecting", prob:15, dueDate:"2026-09-01", contact:"Pedro Morales", sector:"Infraestructura" },
    { id:"opp_005", name:"Planta Solar Atacama Norte BESS", company:"Energías Renovables S.A.", value:48, stage:"proposal", prob:60, dueDate:"2026-04-15", contact:"Carlos Fuentes", sector:"Energía" },
    { id:"opp_006", name:"Línea 9 Metro — Estudios previos", company:"Metro de Santiago", value:15, stage:"qualifying", prob:35, dueDate:"2026-08-01", contact:"Héctor Muñoz", sector:"Transporte" },
    { id:"opp_007", name:"MAPA Arauco — Subcontratos", company:"Celulosa Arauco", value:65, stage:"negotiation", prob:80, dueDate:"2026-05-01", contact:"Daniela Reyes", sector:"Industrial" },
    { id:"opp_008", name:"Campus STEM USM Valparaíso", company:"USM", value:14, stage:"proposal", prob:50, dueDate:"2026-06-15", contact:"Dr. Marco Rendić", sector:"Educación" },
    { id:"opp_009", name:"Represa El Tambolar Argentina", company:"Gobierno San Juan", value:78, stage:"prospecting", prob:20, dueDate:"2026-07-01", contact:"Dirección Hidráulica", sector:"Energía" },
    { id:"opp_010", name:"Estadio Temuco Renovación — Diseño", company:"Ministerio del Deporte", value:9, stage:"closing", prob:85, dueDate:"2026-04-20", contact:"Jefe Proyectos", sector:"Inmobiliario" },
  ];

  /* ─── EXPORT ──────────────────────────────────────────────── */
  global.BD = {
    PROJECTS,
    SCOL,
    SDOT,
    CCOL,
    RNS,
    RSH,
    CAT_COL,
    CAT_ICO,
    CAT_ORD,
    TAG_META,
    TAG_RANK,
    ORG_DB,
    EUR_RATE,
    LANGS,
    PIPELINE_STAGES,
    PIPELINE_OPP,
  };

})(window);
