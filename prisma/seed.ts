import { PrismaClient, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Inicializando base de datos local SQLite para ElectroFix...');

  // Limpieza en orden de relaciones para permitir re-ejecución reproducible
  await prisma.auditLog.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.repairTicket.deleteMany();
  await prisma.priceCatalog.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 1. Dos Talleres (Multi-tenant)
  const tenantCentro = await prisma.tenant.create({
    data: {
      id: 'tenant-centro',
      name: 'ElectroFix Centro',
      phone: '+5491122334455',
    },
  });

  const tenantNorte = await prisma.tenant.create({
    data: {
      id: 'tenant-norte',
      name: 'ElectroFix Norte',
      phone: '+5491199887766',
    },
  });

  // 2. Usuarios con roles para autenticación local
  const adminPasswordHash = bcrypt.hashSync('Admin123!', 10);
  const taller1PasswordHash = bcrypt.hashSync('Taller123!', 10);
  const taller2PasswordHash = bcrypt.hashSync('Taller123!', 10);
  const tecnicoPasswordHash = bcrypt.hashSync('Tecnico123!', 10);

  // Superadmin global (acceso a auditoría y métricas globales)
  const adminUser = await prisma.user.create({
    data: {
      id: 'user-admin',
      email: 'admin@electrofix.local',
      passwordHash: adminPasswordHash,
      name: 'Administrador General',
      role: 'admin',
      tenantId: tenantCentro.id,
    },
  });

  // Taller 1 - Responsable y Técnico
  const taller1User = await prisma.user.create({
    data: {
      id: 'user-taller-centro',
      email: 'taller1@electrofix.local',
      passwordHash: taller1PasswordHash,
      name: 'Martín Gerente Centro',
      role: 'taller',
      tenantId: tenantCentro.id,
    },
  });

  const tecnico1User = await prisma.user.create({
    data: {
      id: 'user-tecnico-centro',
      email: 'tecnico1@electrofix.local',
      passwordHash: tecnicoPasswordHash,
      name: 'Lucas Técnico Centro',
      role: 'tecnico',
      tenantId: tenantCentro.id,
    },
  });

  // Taller 2 - Responsable y Técnico
  const taller2User = await prisma.user.create({
    data: {
      id: 'user-taller-norte',
      email: 'taller2@electrofix.local',
      passwordHash: taller2PasswordHash,
      name: 'Valeria Responsable Norte',
      role: 'taller',
      tenantId: tenantNorte.id,
    },
  });

  const tecnico2User = await prisma.user.create({
    data: {
      id: 'user-tecnico-norte',
      email: 'tecnico2@electrofix.local',
      passwordHash: tecnicoPasswordHash,
      name: 'Santiago Técnico Norte',
      role: 'tecnico',
      tenantId: tenantNorte.id,
    },
  });

  // 3. Catálogo de Precios por Taller (PriceCatalog)
  await prisma.priceCatalog.createMany({
    data: [
      // Taller Centro
      { tenantId: tenantCentro.id, brandModel: 'Samsung A32', serviceName: 'Cambio de Módulo OLED', price: 65000, estimatedTime: '2 a 3 horas', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'Samsung A32', serviceName: 'Cambio de Módulo Incell', price: 42000, estimatedTime: '2 a 3 horas', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'iPhone 13', serviceName: 'Cambio de Pantalla Original', price: 185000, estimatedTime: '3 horas', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'iPhone 11', serviceName: 'Cambio de Batería Certificada', price: 55000, estimatedTime: '1 hora', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'Motorola G20 / G30', serviceName: 'Cambio de Pin de Carga Tipo C', price: 25000, estimatedTime: '2 horas', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'Notebook / PC', serviceName: 'Instalación SSD 480GB + Windows 11', price: 70000, estimatedTime: '24 horas', inStock: true },
      { tenantId: tenantCentro.id, brandModel: 'PlayStation 5', serviceName: 'Reparación Puerto HDMI 2.1', price: 65000, estimatedTime: '48 horas', inStock: true },

      // Taller Norte
      { tenantId: tenantNorte.id, brandModel: 'Samsung S21', serviceName: 'Cambio de Módulo Dynamic AMOLED', price: 145000, estimatedTime: '3 horas', inStock: true },
      { tenantId: tenantNorte.id, brandModel: 'Xiaomi Redmi Note 11', serviceName: 'Cambio de Pantalla Original', price: 52000, estimatedTime: '2 horas', inStock: true },
      { tenantId: tenantNorte.id, brandModel: 'Motorola Edge 30', serviceName: 'Cambio de Batería Original', price: 48000, estimatedTime: '2 horas', inStock: true },
      { tenantId: tenantNorte.id, brandModel: 'MacBook Air M1', serviceName: 'Limpieza y Mantenimiento Térmico', price: 60000, estimatedTime: '24 horas', inStock: true },
    ],
  });

  // 4. Catálogo Global de Servicios de Taller (CatalogItem para cotizador / búsqueda IA)
  await prisma.catalogItem.createMany({
    data: [
      {
        id: 'cat-oled-iphone',
        nombre: 'Cambio Módulo OLED iPhone 13/14',
        modelo: 'iPhone 13 / 14',
        categoria: 'Smartphones',
        precio: 85000,
        tiempo_estimado: '2 a 3 horas',
        stock: 6,
        descripcion: 'Reemplazo de pantalla completa OLED calidad original con reprogramación TrueTone y sellado estanco hermético contra polvo y salpicaduras.',
        palabras_clave: JSON.stringify(['iphone', 'pantalla', 'modulo', 'oled', 'display', 'tactil', 'iphone 13', 'iphone 14', 'rotura']),
        activo: true,
      },
      {
        id: 'cat-pin-carga',
        nombre: 'Cambio Pin de Carga Tipo C',
        modelo: 'Universal / Samsung / Motorola / Xiaomi',
        categoria: 'Smartphones',
        precio: 28000,
        tiempo_estimado: '1 a 2 horas',
        stock: 15,
        descripcion: 'Sustitución de puerto de carga USB Type-C con microsoldadura SMD, limpieza ultrasónica y verificación de amperaje de carga rápida.',
        palabras_clave: JSON.stringify(['pin', 'carga', 'puerto', 'usb-c', 'tipo c', 'no carga', 'falso contacto', 'bateria']),
        activo: true,
      },
      {
        id: 'cat-termico-pc',
        nombre: 'Mantenimiento Térmico PC Gamer & Notebook',
        modelo: 'PC Escritorio / Notebook Gamer',
        categoria: 'Notebooks & PC',
        precio: 38000,
        tiempo_estimado: '3 a 5 horas',
        stock: 10,
        descripcion: 'Limpieza integral con aire comprimido ionizado, cambio de pasta térmica de alto rendimiento Arctic MX-4 / Thermal Grizzly y thermal pads.',
        palabras_clave: JSON.stringify(['mantenimiento', 'termico', 'pasta termica', 'temperatura', 'cooler', 'limpieza', 'gamer', 'notebook', 'pc', 'ruido']),
        activo: true,
      },
      {
        id: 'cat-hdmi-ps5',
        nombre: 'Reparación Puerto HDMI PlayStation 5',
        modelo: 'Sony PlayStation 5',
        categoria: 'Consolas',
        precio: 65000,
        tiempo_estimado: '24 a 48 hs',
        stock: 4,
        descripcion: 'Reemplazo de conector HDMI 2.1 original reforzado con estación de microsoldadura y comprobación con analizador de señal 4K/120Hz.',
        palabras_clave: JSON.stringify(['hdmi', 'ps5', 'playstation', 'sin imagen', 'pantalla negra', 'consola', 'luz azul']),
        activo: true,
      },
      {
        id: 'cat-placa-corto',
        nombre: 'Reparación Placa Base / Corto en Línea Principal',
        modelo: 'Multimarca / Apple / ASUS / Lenovo',
        categoria: 'Microelectrónica',
        precio: 92000,
        tiempo_estimado: '48 a 72 hs',
        stock: 8,
        descripcion: 'Detección termográfica con cámara térmica, inyección controlada de tensión y sustitución de circuitos integrados PMIC, MOSFETs y capacitores SMD en corto.',
        palabras_clave: JSON.stringify(['placa', 'motherboard', 'corto', 'no enciende', 'microelectronica', 'mosfet', 'reballing', 'muerto']),
        activo: true,
      },
      {
        id: 'cat-bat-samsung',
        nombre: 'Cambio Batería Original Samsung Galaxy Serie S / A',
        modelo: 'Samsung Galaxy S20 / S21 / S22 / A52 / A54',
        categoria: 'Smartphones',
        precio: 34000,
        tiempo_estimado: '1 a 2 horas',
        stock: 9,
        descripcion: 'Instalación de batería de litio original nueva con prueba de ciclos de vida útil y calibración de curva de voltaje en software.',
        palabras_clave: JSON.stringify(['bateria', 'samsung', 'bateria agotada', 'no dura la carga', 'galaxy', 'hinchada']),
        activo: true,
      },
      {
        id: 'cat-ssd-upgrade',
        nombre: 'Upgrade SSD NVMe 1TB + Instalación SO y Backup',
        modelo: 'Notebooks y PCs compatibles NVMe',
        categoria: 'Notebooks & PC',
        precio: 78000,
        tiempo_estimado: '3 a 4 horas',
        stock: 7,
        descripcion: 'Instalación de unidad de estado sólido NVMe ultra rápida de 1TB, clonación segura o instalación limpia de sistema operativo y migración de datos.',
        palabras_clave: JSON.stringify(['disco', 'ssd', 'nvme', 'upgrade', 'lenta', 'formateo', 'windows', 'backup', 'memoria']),
        activo: true,
      },
    ],
  });

  // 5. Reparaciones de prueba para Taller Centro (ordenes 1001-1004)
  await prisma.repairTicket.createMany({
    data: [
      {
        id: 'ticket-centro-1',
        orderNumber: 1001,
        trackingToken: 'TRK-CENTRO-1001',
        tenantId: tenantCentro.id,
        customerName: 'Carlos Gómez',
        customerDni: '35111222',
        customerPhone: '1144112233',
        deviceType: 'Celular',
        brandModel: 'Samsung A32',
        reportedIssue: 'Se cayó de frente, suena cuando llaman pero no da imagen.',
        technicalDiagnosis: 'Módulo dañado. Marco en buen estado.',
        estimatedCost: 65000,
        status: TicketStatus.RECEIVED,
      },
      {
        id: 'ticket-centro-2',
        orderNumber: 1002,
        trackingToken: 'TRK-CENTRO-1002',
        tenantId: tenantCentro.id,
        customerName: 'María López',
        customerDni: '40333444',
        customerPhone: '1155667788',
        deviceType: 'Notebook',
        brandModel: 'HP Pavilion 15',
        reportedIssue: 'Levanta mucha temperatura y se apaga sola a los 20 minutos.',
        technicalDiagnosis: 'Cooler trabado con pelusa y pasta seca. Requiere mantenimiento térmico.',
        estimatedCost: 38000,
        status: TicketStatus.WAITING_APPROVAL,
      },
      {
        id: 'ticket-centro-3',
        orderNumber: 1003,
        trackingToken: 'TRK-CENTRO-1003',
        tenantId: tenantCentro.id,
        customerName: 'Juan Pérez',
        customerDni: '28999888',
        customerPhone: '1166778899',
        deviceType: 'Celular',
        brandModel: 'Motorola G20',
        reportedIssue: 'Pin de carga falseado, solo carga si se presiona el cable.',
        technicalDiagnosis: 'Pin tipo C desoldado. Pistas reconstruidas con puente esmaltado.',
        estimatedCost: 28000,
        finalCost: 28000,
        status: TicketStatus.IN_REPAIR,
      },
      {
        id: 'ticket-centro-4',
        orderNumber: 1004,
        trackingToken: 'TRK-CENTRO-1004',
        tenantId: tenantCentro.id,
        customerName: 'Lucía Fernández',
        customerDni: '42777666',
        customerPhone: '1177889900',
        deviceType: 'Celular',
        brandModel: 'iPhone 11',
        reportedIssue: 'Batería en 72%, no dura la jornada laboral.',
        technicalDiagnosis: 'Batería sustituida por repuesto de alta capacidad. Test de carga y descarga superado.',
        estimatedCost: 55000,
        finalCost: 55000,
        qcPassed: true,
        status: TicketStatus.READY_FOR_PICKUP,
      },
    ],
  });

  // 6. Reparaciones de prueba para Taller Norte (ordenes 2001-2002) - para probar aislamiento entre talleres
  await prisma.repairTicket.createMany({
    data: [
      {
        id: 'ticket-norte-1',
        orderNumber: 2001,
        trackingToken: 'TRK-NORTE-2001',
        tenantId: tenantNorte.id,
        customerName: 'Roberto Díaz',
        customerDni: '31555666',
        customerPhone: '1122114455',
        deviceType: 'Celular',
        brandModel: 'Samsung S21',
        reportedIssue: 'Táctil loco después de caída en la calle.',
        technicalDiagnosis: 'Falla en flex del display. Se reemplazará con repuesto Dynamic AMOLED.',
        estimatedCost: 145000,
        status: TicketStatus.DIAGNOSING,
      },
      {
        id: 'ticket-norte-2',
        orderNumber: 2002,
        trackingToken: 'TRK-NORTE-2002',
        tenantId: tenantNorte.id,
        customerName: 'Florencia Romero',
        customerDni: '38111999',
        customerPhone: '1133221100',
        deviceType: 'Consola',
        brandModel: 'PlayStation 5',
        reportedIssue: 'Se cayó con el cable HDMI puesto y se partió la ficha.',
        technicalDiagnosis: 'Conector HDMI 2.1 quebrado internamente. Pistas intactas.',
        estimatedCost: 65000,
        finalCost: 65000,
        qcPassed: true,
        status: TicketStatus.READY_FOR_PICKUP,
      },
    ],
  });

  console.log('✅ Base de datos poblada exitosamente.');
  console.log('Talleres creados:');
  console.log('  - ElectroFix Centro (ID: tenant-centro)');
  console.log('  - ElectroFix Norte (ID: tenant-norte)');
  console.log('Usuarios de prueba creados (contraseñas estándar):');
  console.log('  - Admin:    admin@electrofix.local   / Admin123!');
  console.log('  - Taller 1: taller1@electrofix.local / Taller123! (Centro)');
  console.log('  - Técnico 1: tecnico1@electrofix.local / Tecnico123! (Centro)');
  console.log('  - Taller 2: taller2@electrofix.local / Taller123! (Norte)');
  console.log('  - Técnico 2: tecnico2@electrofix.local / Tecnico123! (Norte)');
}

main()
  .catch((e) => {
    console.error('Error al poblar la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
