import { cn } from "@/shared/lib/utils"

/**
 * Marca de Acredita: la A construida como un pórtico de acceso a faena.

 * Por qué una letra y no un ícono: la categoría entera —se revisó el marcado de
 * once sitios, entre ellos Avetta, Veriforce, ISN y los portales chilenos— usa
 * logotipo genérico en sans neutra o geometría abstracta sin referente. No hay
 * un solo escudo ni candado, contra lo que se creía. El riesgo real no es
 * parecerse a un cliché: es ser invisible. Y ahí una letra inconfundible gana
 * más que un símbolo más significativo.
 *
 * Por qué pórtico: es el objeto real del negocio. Todo el producto existe para
 * que alguien pase por ahí o no. Y como es la inicial del nombre, el símbolo y
 * el logotipo son la misma cosa — no hay que enseñarle a nadie a asociarlos.
 */
export function LogoAcredita({
  size = 28,
  className,
}: {
  size?: number
  className?: string
}) {
  // Tres cortes ópticos, no una fórmula continua: verificado rasterizando a
  // tamaño real, el corte micro se ve tosco en grande y el display desaparece en
  // chico. El travesaño va siempre un punto más fino que las patas.
  const [patas, travesano] =
    size <= 20 ? [8.5, 7.2] : size <= 40 ? [7, 6] : [6.2, 5.4]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Acredita"
    >
      {/* La A de Acredita construida como un pórtico: patas abiertas, dintel
          plano en vez de vértice, travesaño inclinado subiendo a la derecha.

          Reemplaza a la barrera anterior, que evaluada rasterizando a 16, 28 y
          96 px no se leía como barrera sino como lámpara de escritorio — base en
          T, poste y diagonal es la silueta canónica de una lámpara de
          arquitecto. La barrera no se podía refinar: lo que la hace legible son
          las franjas rojas y blancas, y esas mueren a 16 px en una tinta. Las
          composiciones que sí quedaban legibles invertían el significado, porque
          una diagonal cruzando un vano dice "cerrado".

          La tesis original sobrevive entera y con mejor fundamento: anclarse en
          un objeto real del negocio. Y pesa más de lo que su autor creía, porque
          la categoría completa —once sitios revisados— son logotipos genéricos y
          geometría abstracta: nadie es dueño de un objeto concreto.

          La regla de construcción es UN SOLO ÁNGULO. Las patas se abren 17,47°
          de la vertical; el travesaño sube 17,45° de la horizontal. Son el
          mismo. Probado a 0°, 8°, 16° y 26°: a 8° parece un defecto de
          renderizado, a 26° se cierra el contrapunzón, y a 17° se lee como
          intención.

          Los extremos del travesaño están sobre el eje de cada pata, así que
          cambiar el grosor no obliga a recalcular nada. */}
      <path d="M11 39 L19.5 12" strokeWidth={patas} />
      <path d="M37 39 L28.5 12" strokeWidth={patas} />
      <path d="M19.5 12 H28.5" strokeWidth={patas} />
      <path d="M14.56 27.7 L31.74 22.3" strokeWidth={travesano} />
    </svg>
  )
}

/**
 * Marca completa con el nombre.
 *
 * El lock-up con "de BERISA" no es decorativo: "Acredita" solo es un verbo
 * genérico y en Chile varios portales lo usan como descripción. BERISA es lo que
 * lo convierte en nombre propio.
 */
export function MarcaAcredita({
  contexto = "claro",
  subtitulo,
  className,
}: {
  contexto?: "claro" | "oscuro"
  /** Reemplaza "de BERISA", p. ej. "Portal Contratista" en el sidebar. */
  subtitulo?: string
  className?: string
}) {
  const enOscuro = contexto === "oscuro"

  return (
    <div className={cn("flex flex-col", className)}>
      {/* La A del pórtico ES la A de "Acredita", no un ícono al lado del nombre.
          Ponerla aparte obligaba a leer dos veces la misma letra y hacía que el
          conjunto se viera como símbolo prestado + texto. Acá el logotipo y el
          símbolo son una sola cosa, que es la ventaja de que el objeto del
          negocio empiece con la inicial del nombre.

          `items-baseline` con la A alineada por su base: el trazo se apoya en la
          misma línea que el resto de las letras. `alignmentBaseline` no sirve en
          un SVG inline, por eso el ajuste va con un margen negativo calibrado
          contra la altura de mayúscula de IBM Plex. */}
      <div className="flex items-baseline">
        {/* 28 y no 22, que era la paridad matematica con la altura de mayuscula.
            Una letra de trazo abierto se lee mas chica que una solida del mismo
            alto: la correccion es optica, no aritmetica. El margen negativo
            apoya la tinta en la linea base — la caja del SVG tiene 5,5 unidades
            de aire bajo el trazo, que a 28 px son 3,2. */}
        <LogoAcredita
          size={28}
          // La A conserva el color de marca aunque sea una letra de la palabra:
          // es lo que la vuelve marca y no tipografía. Sobre fondo oscuro el
          // cobre no tiene contraste, así que ahí manda el azul claro.
          className={cn(
            "-mb-[3.2px] mr-[2px]",
            enOscuro ? "text-brand-on-dark" : "text-brand-mark",
          )}
        />
        <span
          className={cn(
            "text-[22px] font-medium leading-none tracking-[-0.025em]",
            enOscuro ? "text-ink-inverse" : "text-ink",
          )}
        >
          credita
        </span>
      </div>
      {/* Sangrado al ancho de la A, para que el subtítulo cuelgue del nombre y no
          del borde de la caja. */}
      <p
        className={cn(
          "text-[10px] mt-1.5 ml-[2px] tracking-[0.06em] uppercase",
          enOscuro ? "text-ink-inverse-muted" : "text-ink-subtle",
        )}
      >
        {subtitulo ?? "de BERISA"}
      </p>
    </div>
  )
}
