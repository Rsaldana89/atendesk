// Catálogo de asuntos por DEPARTAMENTO → (asunto, categoría, urgencia)
window.TICKETS_CATALOGO = {
  // —— Panadería —— (ya existente)
  "Panaderia": [
    { subject: "Falla de calidad Panadería", category: "Pan",       urgency: "ALTA"  },
    { subject: "Exceso de Producto",         category: "Pan",       urgency: "MEDIA" },
    { subject: "Faltante de Producto",       category: "Pan",       urgency: "MEDIA" },
    { subject: "Otros",                      category: "Otros Pan", urgency: "BAJA"  }
  ],

  // —— Capital Humano —— (ya existente)
  "Capital Humano": [
    { subject: "Cambio de correo para recibir mi nómina", category: "NOMINA",   urgency: "MEDIA" },
    { subject: "Aclaraciones con mi nómina",              category: "NOMINA",   urgency: "ALTA"  },
    { subject: "Solicitud de reemplazo de tarjeta de vales.", category: "VALES", urgency: "MEDIA" },
    { subject: "Seguimiento a algún trámite (Infonavit, Fonacot, Afore)", category: "TRAMITES", urgency: "MEDIA" },
    { subject: "Otros",                                   category: "OTROS CH", urgency: "MEDIA" }
  ],

  // —— Sistemas —— (WIP: 2 categorías)
  "Sistemas": [
    { subject: "No puedo iniciar Retail",            category: "Retail (Software)", urgency: "ALTA"  },
    { subject: "No se actualizan precios en sistema",category: "Retail (Software)", urgency: "MEDIA" },
    { subject: "No prende mi computadora",           category: "Hardware",          urgency: "ALTA"  }
  ],

  // —— Mantenimiento —— (WIP: 2 categorías)
  "Mantenimiento": [
    { subject: "Bajo voltaje",               category: "ELECTRICIDAD", urgency: "ALTA"  },
    { subject: "Cables eléctricos dañados",  category: "ELECTRICIDAD", urgency: "ALTA"  },
    { subject: "Falla en refrigerador",      category: "REFRIGERADOR", urgency: "ALTA"  }
  ],

  // —— Compras —— (WIP: 2 categorías)
  "Compras": [
    { subject: "No surte proveedor directo Bimbo", category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "No surte proveedor directo Coca",  category: "No surte Proveedor directo", urgency: "ALTA" },
    { subject: "Dudas de promociones",             category: "Precios",                    urgency: "BAJA" }
  ],

  // —— CEDIS —— (WIP: 2 categorías)
  "CEDIS": [
    { subject: "Faltante de mercancía",                       category: "MERCANCIA", urgency: "MEDIA" },
    { subject: "Mercancía en mal estado desde recepción",     category: "MERCANCIA", urgency: "ALTA"  },
    { subject: "No le puedo dar entrada al folio de mi pedido", category: "PEDIDOS",  urgency: "ALTA"  }
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
