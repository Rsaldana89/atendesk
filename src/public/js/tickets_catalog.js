// Catálogo de asuntos por DEPARTAMENTO → (asunto, categoría, urgencia)
window.TICKETS_CATALOGO = {
  // —— Sistemas ——
  "Sistemas": [
    { subject: "No puedo iniciar Retail",                     category: "Retail (Software)", urgency: "ALTA"  },
    { subject: "Retail muy lento",                            category: "Retail (Software)", urgency: "MEDIA" },
    { subject: "No pasan mis tickets",                        category: "Retail (Software)", urgency: "MEDIA" },
    { subject: "No se actualizan precios en sistema",         category: "Retail (Software)", urgency: "MEDIA" },
    { subject: "No se reflejan traspasos",                    category: "Retail (Software)", urgency: "MEDIA" },

    { subject: "No manda la señal de cobro",                  category: "Pinpad",             urgency: "ALTA"  },
    { subject: "Pide actualizar contraseña",                  category: "Pinpad",             urgency: "ALTA"  },
    { subject: "No funciona el contactless",                  category: "Pinpad",             urgency: "BAJA"  },

    { subject: "No salen tickets de la miniprinter",          category: "Miniprinter",        urgency: "MEDIA" },
    { subject: "No salen vouchers de la miniprinter",         category: "Miniprinter",        urgency: "MEDIA" },

    { subject: "No prende mi computadora",                    category: "Hardware",           urgency: "ALTA"  },
    { subject: "No prende mi impresora",                      category: "Hardware",           urgency: "ALTA"  },
    { subject: "No funciona mi teclado",                      category: "Hardware",           urgency: "ALTA"  },
    { subject: "No funciona mi mouse",                        category: "Hardware",           urgency: "ALTA"  },
    { subject: "No funciona mi escáner de PC",                category: "Hardware",           urgency: "MEDIA" },
    { subject: "No reconoce dispositivos USB",                category: "Hardware",           urgency: "MEDIA" },
    { subject: "El cableado está dañado o muy desordenado",   category: "Hardware",           urgency: "MEDIA" },

    { subject: "No pasan los tickets al sistema",             category: "Báscula",            urgency: "MEDIA" },
    { subject: "No imprime ticket la báscula",                category: "Báscula",            urgency: "ALTA"  },
    { subject: "Peso erróneo en la báscula",                  category: "Báscula",            urgency: "MEDIA" },
    { subject: "No se actualizan precios de la báscula",      category: "Báscula",            urgency: "MEDIA" },
    { subject: "Calibración de báscula",                      category: "Báscula",            urgency: "MEDIA" },

    { subject: "No puedo acceder a mis cámaras",              category: "CCTV y Audio",       urgency: "MEDIA" },
    { subject: "No suenan mis bocinas",                       category: "CCTV y Audio",       urgency: "BAJA"  },
    { subject: "No puedo acceder a grabaciones",              category: "CCTV y Audio",       urgency: "MEDIA" },
    { subject: "Falla una o varias cámaras",                  category: "CCTV y Audio",       urgency: "MEDIA" },
    { subject: "Falla monitor de cámaras",                    category: "CCTV y Audio",       urgency: "BAJA"  },

    { subject: "No hay Internet",                              category: "INTERNET",          urgency: "ALTA"  },
    { subject: "No hay línea telefónica",                      category: "INTERNET",          urgency: "MEDIA" },
    { subject: "Hay Internet pero el mundito está gris",       category: "INTERNET",          urgency: "MEDIA" },
    { subject: "El Internet está muy lento",                   category: "INTERNET",          urgency: "MEDIA" },

    { subject: "Error de timbrado: Tasa de impuestos",         category: "FACTURACION",       urgency: "MEDIA" },
    { subject: "Error de timbrado: Nombre",                    category: "FACTURACION",       urgency: "MEDIA" },
    { subject: "Error de timbrado: Uso de CFDI",               category: "FACTURACION",       urgency: "MEDIA" },
    { subject: "Error de timbrado: Dirección fiscal Receptor", category: "FACTURACION",       urgency: "MEDIA" },
    { subject: "Error de timbrado: Dirección fiscal Emisor",   category: "FACTURACION",       urgency: "MEDIA" },

    { subject: "Otros",                                        category: "OTROS SISTEMAS",    urgency: "BAJA"  }
  ],

  // —— Mantenimiento ——
  "Mantenimiento": [
    { subject: "Falla en básculas normales",           category: "BASCULAS",        urgency: "MEDIA" },
    { subject: "Falla en caja fuerte",                 category: "CAJA FUERTE",     urgency: "MEDIA" },
    { subject: "Falla en congelador",                  category: "CONGELADOR",      urgency: "ALTA"  },
    { subject: "Cortina metálica",                     category: "CORTINAS",        urgency: "ALTA"  },
    { subject: "Apagador eléctrico",                   category: "ELECTRICIDAD",    urgency: "MEDIA" },
    { subject: "Generador eléctrico",                  category: "ELECTRICIDAD",    urgency: "ALTA"  },
    { subject: "Alumbrado",                            category: "ELECTRICIDAD",    urgency: "MEDIA" },
    { subject: "Cables eléctricos dañados",            category: "ELECTRICIDAD",    urgency: "ALTA"  },
    { subject: "Falla en lámparas",                    category: "ELECTRICIDAD",    urgency: "BAJA"  },
    { subject: "Falla en planta de luz (interno)",     category: "ELECTRICIDAD",    urgency: "ALTA"  },
    { subject: "Bajo voltaje",                         category: "ELECTRICIDAD",    urgency: "ALTA"  },
    { subject: "Fuga de agua en lámparas",             category: "ELECTRICIDAD",    urgency: "ALTA"  },

    { subject: "Falla en elevador",                    category: "ELEVADOR",        urgency: "MEDIA" },

    { subject: "Cadenas para estacionamiento",         category: "GENERAL",         urgency: "BAJA"  },

    { subject: "Goteras",                              category: "GOTERAS",         urgency: "BAJA"  },
    { subject: "Humedad",                              category: "HUMEDAD",         urgency: "BAJA"  },

    { subject: "WC tapado",                            category: "PLOMERIA",        urgency: "MEDIA" },
    { subject: "Daños en el WC",                       category: "PLOMERIA",        urgency: "MEDIA" },

    { subject: "Falla en puertas de vitrina",          category: "PUERTAS",         urgency: "BAJA"  },
    { subject: "Chapas / cerraduras externas",         category: "PUERTAS",         urgency: "ALTA"  },

    { subject: "Ajuste de rebanadora",                 category: "REBANADORA",      urgency: "MEDIA" },

    { subject: "Falla en refrigerador",                category: "REFRIGERADOR",    urgency: "ALTA"  },
    { subject: "Fuga de agua en refrigeradores",       category: "REFRIGERADOR",    urgency: "MEDIA" },
    { subject: "Fuga en cámara",                       category: "REFRIGERADOR",    urgency: "MEDIA" },

    { subject: "Programa para remodelación",           category: "REMODELACIÓN",    urgency: "BAJA"  },
    { subject: "Pintura",                              category: "REMODELACIÓN",    urgency: "BAJA"  },
    { subject: "Reacomodo de equipo",                  category: "REMODELACIÓN",    urgency: "BAJA"  },
    { subject: "Daños en local",                       category: "REMODELACIÓN",    urgency: "BAJA"  },

    { subject: "Comentarios de salubridad",            category: "SALUBRIDAD",      urgency: "BAJA"  },

    { subject: "Compresor dañado",                     category: "VITRINA",         urgency: "ALTA"  },
    { subject: "Fuga de agua en vitrinas",             category: "VITRINA",         urgency: "MEDIA" },
    { subject: "Display desprogramado de vitrinas",    category: "VITRINA",         urgency: "ALTA"  },

    { subject: "Falla en horno",                       category: "MOBILIARIO",      urgency: "BAJA"  },
    { subject: "Petición de equipo y/o mobiliario",    category: "MOBILIARIO",      urgency: "BAJA"  },

    { subject: "Falla en medidores de CEA",            category: "MUNICIPIO",       urgency: "BAJA"  },
    { subject: "Falla en medidor de luz",              category: "MUNICIPIO",       urgency: "BAJA"  },

    { subject: "Óxido en cámara",                      category: "OXIDO",           urgency: "MEDIA" },
    { subject: "Otros",                                category: "OTROS MANTENIMIENTO", urgency: "BAJA" }
  ],

  // —— Compras ——
  "Compras": [
    { subject: "No surte proveedor directo Coca",      category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Pepsi",     category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Bimbo",     category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Capistrano",category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Huevo",     category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Otros",     category: "No surte Proveedor directo", urgency: "MEDIA" },

    { subject: "Devolución de cliente en sucursal",    category: "Devoluciones",              urgency: "MEDIA" },

    { subject: "Productos que piden los clientes",     category: "Productos",                 urgency: "BAJA" },
    { subject: "Código de barras desactualizado",      category: "Productos",                 urgency: "BAJA" },
    { subject: "Descripción incorrecta de producto",   category: "Productos",                 urgency: "MEDIA" },

    { subject: "Dudas de promociones",                 category: "Precios",                   urgency: "BAJA" },
    { subject: "Dudas de cambios de precios",          category: "Precios",                   urgency: "BAJA" },

    { subject: "Proveedor aparece como inactivo",      category: "Proveedores",               urgency: "MEDIA" },

    { subject: "Falla de calidad La Quinta",           category: "Falla de Calidad",          urgency: "ALTA"  },
    { subject: "Falla de calidad Capistrano",          category: "Falla de Calidad",          urgency: "ALTA"  },
    { subject: "Falla de calidad Coronel",             category: "Falla de Calidad",          urgency: "ALTA"  },
    { subject: "Falla de calidad Otros",               category: "Falla de Calidad",          urgency: "MEDIA" },

    { subject: "Otros",                                category: "Otros Compras",             urgency: "BAJA"  }
  ],

  // —— CEDIS ——
  "CEDIS": [
    { subject: "Faltante de mercancía",                            category: "MERCANCIA", urgency: "MEDIA" },
    { subject: "Mercancía en mal estado desde recepción",          category: "MERCANCIA", urgency: "ALTA"  },
    { subject: "Me cobraron mercancía que no venía",               category: "MERCANCIA", urgency: "ALTA"  },
    { subject: "No le puedo dar entrada al folio de mi pedido",    category: "PEDIDOS",   urgency: "ALTA"  },
    { subject: "Otros",                                            category: "CEDIS OTROS", urgency: "BAJA" }
  ],

  // —— Panadería ——
  "Panaderia": [
    { subject: "Falla de calidad Panadería",  category: "Pan",        urgency: "ALTA"  },
    { subject: "Exceso de Producto",          category: "Pan",        urgency: "MEDIA" },
    { subject: "Faltante de Producto",        category: "Pan",        urgency: "MEDIA" },
    { subject: "Otros",                       category: "Otros Pan",  urgency: "BAJA"  }
  ],

  // —— Capital Humano ——
  "Capital Humano": [
    { subject: "Cambio de correo para recibir mi nómina", category: "NOMINA",   urgency: "MEDIA" },
    { subject: "Aclaraciones con mi nómina",              category: "NOMINA",   urgency: "ALTA"  },
    { subject: "Solicitud de reemplazo de tarjeta de vales.", category: "VALES", urgency: "MEDIA" },
    { subject: "Seguimiento a algún trámite (Infonavit, Fonacot, Afore)", category: "TRAMITES", urgency: "MEDIA" },
    { subject: "Talento Coronel",                                   category: "OTROS CH", urgency: "MEDIA" },
    { subject: "Otros",                                   category: "OTROS CH", urgency: "MEDIA" }
  ],

  // —— Inventario ——
  "Inventarios": [
    { subject: "Mandé mi inventario erróneo o sin ajustar",              category: "INVENTARIO", urgency: "ALTA" },
    { subject: "No puedo ingresar factura o entrada de proveedor",       category: "COMPRAS",    urgency: "ALTA" },
    { subject: "El total de la factura de proveedor no cuadra con sistema", category: "COMPRAS", urgency: "ALTA" }
  ],

  // —— Finanzas ——
  "Finanzas": [
    { subject: "Cargo no reconocido o doble (tarjeta)",           category: "COBROS TARJETA", urgency: "ALTA" },
    { subject: "No ha llegado la devolución al cliente (tarjeta)",category: "COBROS TARJETA", urgency: "ALTA" },
    { subject: "La tarjeta del cliente no pasa",                   category: "COBROS TARJETA", urgency: "MEDIA" },
    { subject: "Ya ingresé datos fiscales y no puedo facturar",          category: "FACTURACION", urgency: "ALTA" }
  ]
};

// —— Utilidades de normalización (ignora acentos y mayúsculas)
window._TK_norm = (s) =>
  (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();

window._TK_getDeptList = (deptName) => {
  const norm = window._TK_norm;
  const want = norm(deptName);
  const cat = window.TICKETS_CATALOGO || {};
  const key = Object.keys(cat).find(k => norm(k) === want);
  return key ? cat[key] : [];
};
