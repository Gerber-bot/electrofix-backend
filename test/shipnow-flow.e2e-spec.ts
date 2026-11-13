import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Shipnow Flow & Workshop Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let taller1Token: string;
  let taller2Token: string;
  let createdTicketId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Control de acceso: Visitante no autenticado', () => {
    it('debe rechazar la consulta de tickets sin token (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .get('/tickets')
        .expect(401);
    });

    it('debe rechazar la creación de tickets sin token (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .send({
          customerName: 'Intruso',
          customerDni: '11111111',
          customerPhone: '1100000000',
          deviceType: 'Celular',
          brandModel: 'Test Device',
          reportedIssue: 'Test',
        })
        .expect(401);
    });

    it('debe rechazar el acceso a métricas administrativas sin token (401)', async () => {
      await request(app.getHttpServer())
        .get('/admin-suite/dashboard/metrics')
        .expect(401);
    });
  });

  describe('2. Autenticación local y obtención de sesión', () => {
    it('debe rechazar login con credenciales erróneas (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'taller1@electrofix.local',
          password: 'PasswordIncorrecta',
        })
        .expect(401);

      expect(res.body.message).toContain('inválidas');
    });

    it('debe iniciar sesión correctamente para Taller Centro (taller1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'taller1@electrofix.local',
          password: 'Taller123!',
        })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.role).toBe('taller');
      expect(res.body.user.tenantId).toBe('tenant-centro');
      taller1Token = res.body.access_token;
    });

    it('debe verificar la identidad en /auth/me con el token de Taller Centro', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${taller1Token}`)
        .expect(200);

      expect(res.body.user.email).toBe('taller1@electrofix.local');
      expect(res.body.user.tenantId).toBe('tenant-centro');
    });

    it('debe iniciar sesión correctamente para Taller Norte (taller2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'taller2@electrofix.local',
          password: 'Taller123!',
        })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.role).toBe('taller');
      expect(res.body.user.tenantId).toBe('tenant-norte');
      taller2Token = res.body.access_token;
    });
  });

  describe('3. Flujo de Reparaciones y Aislamiento Multi-Taller', () => {
    it('Taller 1 crea una reparación en su taller', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${taller1Token}`)
        .send({
          customerName: 'Cliente Centro E2E',
          customerDni: '33444555',
          customerPhone: '1133445566',
          deviceType: 'Celular',
          brandModel: 'Samsung A32',
          reportedIssue: 'Pantalla rota sin imagen',
          estimatedCost: 65000,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.tenantId).toBe('tenant-centro');
      expect(res.body.orderNumber).toBeGreaterThan(1000);
      createdTicketId = res.body.id;
    });

    it('Taller 1 puede consultar su propia reparación', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${taller1Token}`)
        .expect(200);

      expect(res.body.id).toBe(createdTicketId);
      expect(res.body.customerName).toBe('Cliente Centro E2E');
    });

    it('Taller 2 (Norte) NO ve la reparación de Taller 1 en su lista de tickets', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${taller2Token}`)
        .expect(200);

      const found = res.body.find((t: any) => t.id === createdTicketId);
      expect(found).toBeUndefined();
      // Aseguramos que solo ve sus propios tickets (tenant-norte)
      for (const t of res.body) {
        expect(t.tenantId).toBe('tenant-norte');
      }
    });

    it('Taller 2 (Norte) NO puede leer el ticket de Taller 1 por ID (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${taller2Token}`)
        .expect(403);
    });

    it('Taller 2 (Norte) NO puede modificar el ticket de Taller 1 (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${taller2Token}`)
        .send({
          technicalDiagnosis: 'Intento de edición no autorizada desde otro taller',
        })
        .expect(403);
    });
  });

  describe('4. Cotizador y Catálogo', () => {
    it('debe listar ítems de catálogo público', async () => {
      const res = await request(app.getHttpServer())
        .get('/catalog')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const iphoneScreen = res.body.find((item: any) =>
        item.nombre.toLowerCase().includes('oled iphone'),
      );
      expect(iphoneScreen).toBeDefined();
      expect(iphoneScreen.precio).toBe(85000);
    });

    it('el chat público cotiza servicios oficiales del catálogo usando fallback heurístico', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat')
        .send({
          message: '¿Cuánto sale el cambio de módulo OLED de iPhone 13?',
        })
        .expect(201);

      expect(res.body.reply).toBeDefined();
      expect(res.body.reply).toContain('85.000');
      expect(res.body.isAiGenerated).toBe(false);
      expect(res.body.source).toBe('heuristic_fallback');
    });

    it('el chat público NO divulga datos privados de reparaciones ante consultas con DNI', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat')
        .send({
          message: 'Quiero ver el estado de reparación del DNI 35111222',
        })
        .expect(201);

      expect(res.body.reply).toBeDefined();
      // No debe contener el nombre ni el diagnóstico técnico del cliente
      expect(res.body.reply).not.toContain('Carlos Gómez');
      expect(res.body.reply).not.toContain('Marco en buen estado');
      expect(res.body.reply).toMatch(/privacidad|seguimiento/i);
    });

    it('el seguimiento público funciona de forma legítima mediante token único', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/track/TRK-CENTRO-1001')
        .expect(200);

      expect(res.body.orderNumber).toBe(1001);
      expect(res.body.brandModel).toBe('Samsung A32');
      expect(res.body.status).toBe('RECEIVED');
    });
  });
});
