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
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoAcredita
        size={28}
        // El cobre es el color de marca, y solo vive en superficies de marca.
        // Sobre fondo oscuro no tiene contraste suficiente, así que ahí manda el
        // azul claro (9.36:1 contra el sidebar).
        className={enOscuro ? "text-brand-on-dark" : "text-brand-mark"}
      />
      <div>
        <p
          className={cn(
            "text-[19px] font-medium leading-none tracking-[-0.02em]",
            enOscuro ? "text-ink-inverse" : "text-ink"
          )}
        >
          Acredita
        </p>
        <p
          className={cn(
            "text-[10px] mt-1 tracking-[0.04em]",
            enOscuro ? "text-ink-inverse-muted" : "text-ink-subtle"
          )}
        >
          {subtitulo ?? "de BERISA"}
        </p>
      </div>
    </div>
  )
}
