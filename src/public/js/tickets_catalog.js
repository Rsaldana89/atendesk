// Catálogo de asuntos por DEPARTAMENTO → (asunto, categoría, urgencia)
window.TICKETS_CATALOGO = {
  // —— Mantenimiento ——
  "Mantenimiento": [
    { subject: "Falla en básculas normales", category: "BASCULAS", urgency: "MEDIA" },
    { subject: "Otros (Básculas)", category: "BASCULAS", urgency: "BAJA" },

    { subject: "Falla en caja fuerte", category: "CAJA FUERTE", urgency: "MEDIA" },
    { subject: "Otros (Caja Fuerte)", category: "CAJA FUERTE", urgency: "BAJA" },

    { subject: "Falla en congelador", category: "CONGELADOR", urgency: "ALTA" },
    { subject: "Otros (Congelador)", category: "CONGELADOR", urgency: "BAJA" },

    { subject: "Cortina metálica", category: "CORTINAS", urgency: "ALTA" },
    { subject: "Otros (Cortinas)", category: "CORTINAS", urgency: "BAJA" },

    { subject: "Apagador eléctrico", category: "ELECTRICIDAD", urgency: "MEDIA" },
    { subject: "Generador eléctrico", category: "ELECTRICIDAD", urgency: "ALTA" },
    { subject: "Alumbrado", category: "ELECTRICIDAD", urgency: "MEDIA" },
    { subject: "Cables eléctricos dañados", category: "ELECTRICIDAD", urgency: "ALTA" },
    { subject: "Falla en lámparas", category: "ELECTRICIDAD", urgency: "BAJA" },
    { subject: "Falla en planta de luz (interno)", category: "ELECTRICIDAD", urgency: "ALTA" },
    { subject: "Bajo voltaje", category: "ELECTRICIDAD", urgency: "ALTA" },
    { subject: "Fuga de agua en lámparas", category: "ELECTRICIDAD", urgency: "ALTA" },
    { subject: "Otros (Electricidad)", category: "ELECTRICIDAD", urgency: "BAJA" },

    { subject: "Falla en elevador", category: "ELEVADOR", urgency: "MEDIA" },
    { subject: "Otros (Elevador)", category: "ELEVADOR", urgency: "BAJA" },

    { subject: "Cadenas para estacionamiento", category: "GENERAL", urgency: "BAJA" },
    { subject: "Otros (General)", category: "GENERAL", urgency: "BAJA" },

    { subject: "Goteras", category: "GOTERAS", urgency: "BAJA" },
    { subject: "Otros (Goteras)", category: "GOTERAS", urgency: "BAJA" },

    { subject: "Humedad", category: "HUMEDAD", urgency: "BAJA" },
    { subject: "Otros (Humedad)", category: "HUMEDAD", urgency: "BAJA" },

    { subject: "WC tapado", category: "PLOMERIA", urgency: "MEDIA" },
    { subject: "Daños en el WC", category: "PLOMERIA", urgency: "MEDIA" },
    { subject: "Otros (Plomería)", category: "PLOMERIA", urgency: "BAJA" },

    { subject: "Falla en puertas de vitrina", category: "PUERTAS", urgency: "BAJA" },
    { subject: "Chapas / cerraduras externas", category: "PUERTAS", urgency: "ALTA" },
    { subject: "Otros (Puertas)", category: "PUERTAS", urgency: "BAJA" },

    { subject: "Ajuste de rebanadora", category: "REBANADORA", urgency: "MEDIA" },
    { subject: "Otros (Rebanadora)", category: "REBANADORA", urgency: "BAJA" },

    { subject: "Falla en refrigerador", category: "REFRIGERADOR", urgency: "ALTA" },
    { subject: "Fuga de agua en refrigeradores", category: "REFRIGERADOR", urgency: "MEDIA" },
    { subject: "Fuga en cámara", category: "REFRIGERADOR", urgency: "MEDIA" },
    { subject: "Otros (Refrigerador)", category: "REFRIGERADOR", urgency: "BAJA" },

    { subject: "Programa para remodelación", category: "REMODELACIÓN", urgency: "BAJA" },
    { subject: "Pintura", category: "REMODELACIÓN", urgency: "BAJA" },
    { subject: "Reacomodo de equipo", category: "REMODELACIÓN", urgency: "BAJA" },
    { subject: "Daños en local", category: "REMODELACIÓN", urgency: "BAJA" },
    { subject: "Otros (Remodelación)", category: "REMODELACIÓN", urgency: "BAJA" },

    { subject: "Comentarios de salubridad", category: "SALUBRIDAD", urgency: "BAJA" },
    { subject: "Otros (Salubridad)", category: "SALUBRIDAD", urgency: "BAJA" },

    { subject: "Compresor dañado", category: "VITRINA", urgency: "ALTA" },
    { subject: "Fuga de agua en vitrinas", category: "VITRINA", urgency: "MEDIA" },
    { subject: "Display desprogramado de vitrinas", category: "VITRINA", urgency: "ALTA" },
    { subject: "Otros (Vitrina)", category: "VITRINA", urgency: "BAJA" },

    { subject: "Falla en horno", category: "MOBILIARIO", urgency: "BAJA" },
    { subject: "Petición de equipo y/o mobiliario", category: "MOBILIARIO", urgency: "BAJA" },
    { subject: "Otros (Mobiliario)", category: "MOBILIARIO", urgency: "BAJA" },

    { subject: "Falla en medidores de CEA", category: "MUNICIPIO", urgency: "BAJA" },
    { subject: "Falla en medidor de luz", category: "MUNICIPIO", urgency: "BAJA" },
    { subject: "Otros (Municipio)", category: "MUNICIPIO", urgency: "BAJA" },

    { subject: "Óxido en cámara", category: "OXIDO", urgency: "MEDIA" },
    { subject: "Otros (Óxido)", category: "OXIDO", urgency: "BAJA" },

    { subject: "Otros", category: "OTROS MANTENIMIENTO", urgency: "BAJA" }
  ],

  // —— Finanzas ——
  "Finanzas": [
    { subject: "El cliente se queja de un cargo no reconocido o doble", category: "COBROS TARJETA", urgency: "MEDIA" },
    { subject: "No llega la devolución del cliente", category: "COBROS TARJETA", urgency: "MEDIA" },
    { subject: "La tarjeta del cliente no pasa", category: "COBROS TARJETA", urgency: "MEDIA" },
    { subject: "Otros (Cobros tarjeta)", category: "COBROS TARJETA", urgency: "BAJA" },

    { subject: "Error en apertura y cierre de caja", category: "CORTES", urgency: "MEDIA" },
    { subject: "Error en captura de depósitos bancarios Retail", category: "DEPOSITOS", urgency: "MEDIA" },
    { subject: "Visita de autoridades a tienda", category: "OTROS", urgency: "ALTA" },
    { subject: "Otros (Finanzas)", category: "OTROS", urgency: "MEDIA" }
  ],

  // —— Panadería ——
  "Panaderia": [
    { subject: "Falla de calidad Panadería", category: "PAN", urgency: "ALTA" },
    { subject: "Exceso de producto", category: "PAN", urgency: "MEDIA" },
    { subject: "Faltante de producto", category: "PAN", urgency: "MEDIA" },
    { subject: "Cargos dobles en sistema de producto", category: "PAN", urgency: "MEDIA" },
    { subject: "Devoluciones o merma de producto", category: "PAN", urgency: "MEDIA" },
    { subject: "Otros (Pan)", category: "PAN", urgency: "BAJA" },
    { subject: "Otros", category: "OTROS PAN", urgency: "BAJA" }
  ],

  // —— Inventarios ——
  "Inventarios": [
    { subject: "Mandé mi inventario erróneo o sin ajustar", category: "INVENTARIO", urgency: "ALTA" },
    { subject: "Revisión y cotejo folios de pedido CEDIS-Sucursales", category: "INVENTARIO", urgency: "MEDIA" },
    { subject: "Error en la captura de mercancía proveedores (un producto por otro)", category: "INVENTARIO", urgency: "MEDIA" },
    { subject: "Otros (Inventario)", category: "INVENTARIO", urgency: "BAJA" },

    { subject: "No puedo ingresar factura o entrada de proveedor", category: "COMPRAS", urgency: "ALTA" },
    { subject: "El total de la factura de proveedor no cuadra con sistema", category: "COMPRAS", urgency: "ALTA" },
    { subject: "Otros (Compras)", category: "COMPRAS", urgency: "BAJA" }
  ],

    // —— Compras ——
  "Compras": [
    // Falla de calidad
    { subject: "Falla de calidad La Quinta", category: "FALLA DE CALIDAD", urgency: "ALTA" },
    { subject: "Falla de calidad Capistrano", category: "FALLA DE CALIDAD", urgency: "ALTA" },
    { subject: "Falla de calidad Coronel", category: "FALLA DE CALIDAD", urgency: "ALTA" },
    { subject: "Falla de calidad de Capistrano", category: "FALLA DE CALIDAD", urgency: "ALTA" },
    { subject: "Falla de calidad Otros", category: "FALLA DE CALIDAD", urgency: "MEDIA" },
    { subject: "Otros (Falla de calidad)", category: "FALLA DE CALIDAD", urgency: "BAJA" },

    // No surte proveedor directo (por proveedor)
    { subject: "No surte proveedor directo Alpura", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Sabritas", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Araceli", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Gamesa", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Leche Qro", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Kelloggs", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Ochoa", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Bachoco", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Frijoles Puercos", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Huevo Santiago", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Peñafiel", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Santo Sano", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Trapeador", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Coca", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Pepsi", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Bimbo", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Capistrano", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "No surte proveedor directo Huevo Rojo", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },

    // Genéricos para proveedor directo
    { subject: "No surte proveedor directo (varios)", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "ALTA" },
    { subject: "Otros (Proveedores directos)", category: "NO SURTE PROVEEDOR DIRECTO", urgency: "BAJA" },

    // Devoluciones
    { subject: "Devolucion de cliente en sucursal", category: "DEVOLUCIONES", urgency: "MEDIA" },
    { subject: "Otros (Devoluciones)", category: "DEVOLUCIONES", urgency: "BAJA" },

    // Productos
    { subject: "Productos que piden los clientes", category: "PRODUCTOS", urgency: "BAJA" },
    { subject: "Codigo de barras desactualizado", category: "PRODUCTOS", urgency: "BAJA" },
    { subject: "Descripcion incorrecta de producto", category: "PRODUCTOS", urgency: "MEDIA" },
    { subject: "Otros (Productos)", category: "PRODUCTOS", urgency: "BAJA" },

    // Precios
    { subject: "Dudas de promociones", category: "PRECIOS", urgency: "BAJA" },
    { subject: "Dudas de cambios de precios", category: "PRECIOS", urgency: "BAJA" },
    { subject: "Otros (Precios)", category: "PRECIOS", urgency: "BAJA" },

    // Proveedores
    { subject: "Proveedor aparece como inactivo", category: "PROVEEDORES", urgency: "MEDIA" },
    { subject: "Otros (Proveedores)", category: "PROVEEDORES", urgency: "BAJA" },

    // Otros
    { subject: "Otros", category: "OTROS COMPRAS", urgency: "BAJA" }
  ],


  // —— Capital Humano ——
  "Capital Humano": [
    { subject: "Cambio de correo para recibir mi nómina", category: "NOMINA", urgency: "MEDIA" },
    { subject: "Aclaraciones con mi nómina", category: "NOMINA", urgency: "ALTA" },
    { subject: "Otros (Nómina)", category: "NOMINA", urgency: "BAJA" },

    { subject: "Solicitud de reemplazo de tarjeta de vales", category: "VALES", urgency: "MEDIA" },
    { subject: "Otros (Vales)", category: "VALES", urgency: "BAJA" },

    { subject: "Seguimiento a algún trámite (Infonavit, Fonacot, Afore)", category: "TRAMITES", urgency: "MEDIA" },
    { subject: "Otros (Trámites)", category: "TRAMITES", urgency: "BAJA" },

    { subject: "Bloqueo de acceso a TalentoCoronel", category: "PLATAFORMAS", urgency: "BAJA" },
    { subject: "Bloqueo de acceso a Fondo de Ahorro BBVA", category: "PLATAFORMAS", urgency: "BAJA" },
    { subject: "Otros (Plataformas)", category: "PLATAFORMAS", urgency: "BAJA" },

    { subject: "Talento Coronel", category: "OTROS CH", urgency: "MEDIA" },
    { subject: "Otros", category: "OTROS CH", urgency: "MEDIA" }
  ],

  // —— Sistemas ——
  "Sistemas": [
    // Retail
    { subject: "No puedo iniciar Retail", category: "RETAIL (SOFTWARE)", urgency: "ALTA" },
    { subject: "Retail muy lento", category: "RETAIL (SOFTWARE)", urgency: "MEDIA" },
    { subject: "No pasan mis tickets", category: "RETAIL (SOFTWARE)", urgency: "MEDIA" },
    { subject: "No se actualizan precios en sistema", category: "RETAIL (SOFTWARE)", urgency: "MEDIA" },
    { subject: "No se reflejan traspasos", category: "RETAIL (SOFTWARE)", urgency: "MEDIA" },
    { subject: "Otros (Retail)", category: "RETAIL (SOFTWARE)", urgency: "BAJA" },

    // Pinpad
    { subject: "No manda la señal de cobro", category: "PINPAD", urgency: "ALTA" },
    { subject: "Pide actualizar contraseña", category: "PINPAD", urgency: "ALTA" },
    { subject: "No funciona el contactless", category: "PINPAD", urgency: "BAJA" },
    { subject: "Otros (Pinpad)", category: "PINPAD", urgency: "BAJA" },

    // Miniprinter
    { subject: "No salen tickets de la miniprinter", category: "MINPRINTER", urgency: "MEDIA" },
    { subject: "No salen vouchers de la miniprinter", category: "MINPRINTER", urgency: "MEDIA" },
    { subject: "Otros (Miniprinter)", category: "MINPRINTER", urgency: "BAJA" },

    // Hardware
    { subject: "No prende mi computadora", category: "HARDWARE", urgency: "ALTA" },
    { subject: "No prende mi impresora", category: "HARDWARE", urgency: "ALTA" },
    { subject: "No funciona mi teclado", category: "HARDWARE", urgency: "ALTA" },
    { subject: "No funciona mi mouse", category: "HARDWARE", urgency: "ALTA" },
    { subject: "No funciona mi escáner de PC", category: "HARDWARE", urgency: "MEDIA" },
    { subject: "No reconoce dispositivos USB", category: "HARDWARE", urgency: "MEDIA" },
    { subject: "El cableado está dañado o muy desordenado", category: "HARDWARE", urgency: "MEDIA" },
    { subject: "Otros (Hardware)", category: "HARDWARE", urgency: "BAJA" },

    // Báscula
    { subject: "No pasan los tickets al sistema", category: "BASCULA", urgency: "MEDIA" },
    { subject: "No imprime ticket la báscula", category: "BASCULA", urgency: "ALTA" },
    { subject: "Peso erróneo en la báscula", category: "BASCULA", urgency: "MEDIA" },
    { subject: "No se actualizan precios de la báscula", category: "BASCULA", urgency: "MEDIA" },
    { subject: "Calibración de báscula", category: "BASCULA", urgency: "MEDIA" },
    { subject: "Otros (Báscula)", category: "BASCULA", urgency: "BAJA" },

    // CCTV
    { subject: "No puedo acceder a mis cámaras", category: "CCTV Y AUDIO", urgency: "MEDIA" },
    { subject: "No suenan mis bocinas", category: "CCTV Y AUDIO", urgency: "BAJA" },
    { subject: "No puedo acceder a grabaciones", category: "CCTV Y AUDIO", urgency: "MEDIA" },
    { subject: "Falla una o varias cámaras", category: "CCTV Y AUDIO", urgency: "MEDIA" },
    { subject: "Falla monitor de cámaras", category: "CCTV Y AUDIO", urgency: "BAJA" },
    { subject: "Otros (CCTV y Audio)", category: "CCTV Y AUDIO", urgency: "BAJA" },

    // Internet
    { subject: "No hay Internet", category: "INTERNET", urgency: "ALTA" },
    { subject: "No hay línea telefónica", category: "INTERNET", urgency: "MEDIA" },
    { subject: "Hay Internet pero el mundito está gris", category: "INTERNET", urgency: "MEDIA" },
    { subject: "El Internet está muy lento", category: "INTERNET", urgency: "MEDIA" },
    { subject: "Otros (Internet)", category: "INTERNET", urgency: "BAJA" },

    // Personal
    { subject: "Alta de personal", category: "ALTAS", urgency: "ALTA" },
    { subject: "Baja de personal", category: "BAJAS", urgency: "ALTA" },

    { subject: "Otros", category: "OTROS SISTEMAS", urgency: "BAJA" }
  ],

  // —— CEDIS ——
  "CEDIS": [
    { subject: "Faltante de mercancía", category: "MERCANCIA", urgency: "MEDIA" },
    { subject: "No me cobraron mercancía que viene en el pedido", category: "MERCANCIA", urgency: "ALTA" },
    { subject: "Me cobraron mercancía que no venía", category: "MERCANCIA", urgency: "ALTA" },
    { subject: "Viene una cantidad de mercancía cobrada superior a lo que me entregaron", category: "MERCANCIA", urgency: "ALTA" },
    { subject: "Viene una cantidad de mercancía cobrada inferior a lo que me entregaron", category: "MERCANCIA", urgency: "ALTA" },
    { subject: "En la entrega viene cambiado el producto cobrado por otro no solicitado", category: "MERCANCIA", urgency: "ALTA" },
    { subject: "Mercancía en mal estado desde recepción", category: "MERCANCIA", urgency: "MEDIA" },
    { subject: "Mercancía en mal estado al abrir la caja (no después de 24 horas de la recepción)", category: "MERCANCIA", urgency: "MEDIA" },
    { subject: "Otros (Mercancía)", category: "MERCANCIA", urgency: "BAJA" },

    { subject: "No le puedo dar entrada al folio de mi pedido", category: "INVENTARIOS", urgency: "ALTA" },
    { subject: "Folio pendiente por entrega sin traspaso", category: "INVENTARIOS", urgency: "ALTA" },
    { subject: "Mandé una devolución de producto y me regresaron el cargo en sistema", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "No puedo enviar mi pedido porque no tengo internet", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "No puedo enviar mi pedido porque no tengo luz", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "No me llegó el pan completo y me lo cobraron", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "El chofer no se quiso esperar a la revisión del pedido", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "El chofer no se llevó la devolución que le entregué", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "El chofer fue descortés", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "No me llegó toda la mercancía que solicité", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "No me llegó pedido de CEDIS (cámara o abarrote) y sí hice pedido", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "El chofer me está entregando muy tarde mi pedido", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "El chofer me quedó de reponer mercancía faltante y no me la trae", category: "INVENTARIOS", urgency: "MEDIA" },
    { subject: "Otros (Inventarios)", category: "INVENTARIOS", urgency: "BAJA" },

    { subject: "Otros", category: "OTROS CEDIS", urgency: "MEDIA" }
  ]
};

// —— Utilidades de normalización (ignora acentos y mayúsculas)
window._TK_norm = (s) =>
  (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

window._TK_getDeptList = (deptName) => {
  const norm = window._TK_norm;
  const want = norm(deptName);
  const cat = window.TICKETS_CATALOGO || {};
  const key = Object.keys(cat).find((k) => norm(k) === want);
  return key ? cat[key] : [];
};
