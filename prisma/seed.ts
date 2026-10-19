import { PrismaClient, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Crear el Taller (Tenant principal)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'ElectroFix Servicio Técnico',
      phone: '+5493794000000',
    },
  });

  // 2. Cargar Catálogo de Precios para el Agente Cotizador
  await prisma.priceCatalog.createMany({
    data: [
      { tenantId: tenant.id, brandModel: 'Samsung A32', serviceName: 'Cambio de Módulo OLED', price: 65000, estimatedTime: '2 a 3 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'Samsung A32', serviceName: 'Cambio de Módulo Incell (Económico)', price: 42000, estimatedTime: '2 a 3 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'iPhone 13', serviceName: 'Cambio de Pantalla Original', price: 185000, estimatedTime: '3 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'iPhone 11', serviceName: 'Cambio de Batería Certificada', price: 55000, estimatedTime: '1 hora', inStock: true },
      { tenantId: tenant.id, brandModel: 'Motorola G20 / G30', serviceName: 'Cambio de Pin de Carga Tipo C', price: 25000, estimatedTime: '2 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'Notebook / PC', serviceName: 'Instalación SSD 480GB + Windows 11 + Backup', price: 70000, estimatedTime: '24 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'Notebook / PC', serviceName: 'Mantenimiento Térmico (Limpieza + Pasta Arctic MX-4)', price: 30000, estimatedTime: '3 a 4 horas', inStock: true },
      { tenantId: tenant.id, brandModel: 'PlayStation 4 / PS5', serviceName: 'Reparación HDMI / Mantenimiento', price: 58000, estimatedTime: '48 horas', inStock: true },
    ],
  });

  // 3. Crear 4 Órdenes de Reparación en distintos estados del Kanban
  await prisma.repairTicket.createMany({
    data: [
      {
        tenantId: tenant.id,
        customerName: 'Carlos Gómez',
        customerDni: '35111222',
        customerPhone: '3794112233',
        deviceType: 'Celular',
        brandModel: 'Samsung A32',
        reportedIssue: 'Se cayó, suena cuando llaman pero la pantalla queda negra.',
        estimatedCost: 65000,
        status: TicketStatus.RECEIVED,
      },
      {
        tenantId: tenant.id,
        customerName: 'María López',
        customerDni: '40333444',
        customerPhone: '3794556677',
        deviceType: 'Notebook',
        brandModel: 'HP Pavilion 15',
        reportedIssue: 'Anda muy lenta y calienta mucho al abrir programas.',
        technicalDiagnosis: 'Disco rígido mecánico con sectores dañados y disipador obstruido. Se recomienda SSD 480GB + limpieza térmica.',
        estimatedCost: 85000,
        status: TicketStatus.WAITING_APPROVAL,
      },
      {
        tenantId: tenant.id,
        customerName: 'Juan Pérez',
        customerDni: '28999888',
        customerPhone: '3794889900',
        deviceType: 'Celular',
        brandModel: 'Motorola G20',
        reportedIssue: 'Falso contacto al cargar, hay que mover el cable.',
        technicalDiagnosis: 'Pin tipo C desoldado en pistas de carga rápida. En banco realizando microsoldadura.',
        estimatedCost: 25000,
        finalCost: 25000,
        status: TicketStatus.IN_REPAIR,
      },
      {
        tenantId: tenant.id,
        customerName: 'Lucía Fernández',
        customerDni: '42777666',
        customerPhone: '3794223344',
        deviceType: 'Celular',
        brandModel: 'iPhone 11',
        reportedIssue: 'La batería dura menos de medio día (condición 71%).',
        technicalDiagnosis: 'Batería reemplazada con éxito. Pasó control de calidad de 5 puntos (carga, cámaras, FaceID, audio y táctil OK).',
        estimatedCost: 55000,
        finalCost: 55000,
        qcPassed: true,
        status: TicketStatus.READY_FOR_PICKUP,
      },
    ],
  });

  console.log('✅ Base de datos poblada con éxito. Tenant ID:', tenant.id);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());