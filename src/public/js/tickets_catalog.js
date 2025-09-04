// Catálogo de asuntos por DEPARTAMENTO → (asunto, categoría, urgencia)
window.TICKETS_CATALOGO = {
  // —— Panadería ——
  "Panaderia": [
    { subject: "Falla de calidad Panadería", category: "Pan",       urgency: "ALTA"  },
    { subject: "Exceso de Producto",         category: "Pan",       urgency: "MEDIA" },
    { subject: "Faltante de Producto",       category: "Pan",       urgency: "MEDIA" },
    { subject: "Otros",                      category: "Otros Pan", urgency: "BAJA"  }
  ],

  // —— CH ——
  "CH": [
    { subject: "Cambio de correo para recibir mi nómina", category: "NOMINA",   urgency: "MEDIA" },
    { subject: "Aclaraciones con mi nómina",              category: "NOMINA",   urgency: "ALTA"  },
    { subject: "Solicitud de reemplazo de tarjeta de vales.", category: "VALES", urgency: "MEDIA" },
    { subject: "Seguimiento a algún trámite (Infonavit, Fonacot, Afore)", category: "TRAMITES", urgency: "MEDIA" },
    { subject: "Otros",                                   category: "OTROS CH", urgency: "MEDIA" }
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
