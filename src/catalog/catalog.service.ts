import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin-suite/audit/audit.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { randomUUID } from 'crypto';

export interface CatalogItemEntity {
  id: string;
  nombre: string;
  modelo: string | null;
  categoria: string;
  precio: number;
  tiempo_estimado: string;
  stock: number;
  descripcion: string;
  palabras_clave: string[];
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureTableExists();
    await this.seedInitialItemsIfEmpty();
  }

  private async ensureTableExists() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "catalog_items" (
          "id" TEXT PRIMARY KEY,
          "nombre" TEXT NOT NULL,
          "modelo" TEXT,
          "categoria" TEXT NOT NULL,
          "precio" DOUBLE PRECISION NOT NULL,
          "tiempo_estimado" TEXT NOT NULL,
          "stock" INTEGER NOT NULL DEFAULT 0,
          "descripcion" TEXT NOT NULL,
          "palabras_clave" TEXT[] NOT NULL DEFAULT '{}',
          "activo" BOOLEAN NOT NULL DEFAULT TRUE,
          "creado_en" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "actualizado_en" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "catalog_items_categoria_idx" ON "catalog_items"("categoria");
        CREATE INDEX IF NOT EXISTS "catalog_items_activo_idx" ON "catalog_items"("activo");
      `);
    } catch (err: unknown) {
      this.logger.warn(`Could not ensure catalog_items table via SQL: ${(err as Error).message}`);
    }
  }

  private async seedInitialItemsIfEmpty() {
    try {
      const count = await this.count();
      if (count === 0) {
        this.logger.log('Catalog is empty. Seeding initial workshop services...');
        const initialSeeds: Array<Omit<CatalogItemEntity, 'id' | 'creado_en' | 'actualizado_en'>> = [
          {
            nombre: 'Cambio Módulo OLED iPhone 13/14',
            modelo: 'iPhone 13 / 14',
            categoria: 'Smartphones',
            precio: 85000,
            tiempo_estimado: '2 a 3 horas',
            stock: 6,
            descripcion: 'Reemplazo de pantalla completa OLED calidad original con reprogramación TrueTone y sellado estanco hermético contra polvo y salpicaduras.',
            palabras_clave: ['iphone', 'pantalla', 'modulo', 'oled', 'display', 'tactil', 'iphone 13', 'iphone 14', 'rotura'],
            activo: true,
          },
          {
            nombre: 'Cambio Pin de Carga Tipo C',
            modelo: 'Universal / Samsung / Motorola / Xiaomi',
            categoria: 'Smartphones',
            precio: 28000,
            tiempo_estimado: '1 a 2 horas',
            stock: 15,
            descripcion: 'Sustitución de puerto de carga USB Type-C con microsoldadura SMD, limpieza ultrasónica y verificación de amperaje de carga rápida.',
            palabras_clave: ['pin', 'carga', 'puerto', 'usb-c', 'tipo c', 'no carga', 'falso contacto', 'bateria'],
            activo: true,
          },
          {
            nombre: 'Mantenimiento Térmico PC Gamer & Notebook',
            modelo: 'PC Escritorio / Notebook Gamer',
            categoria: 'Notebooks & PC',
            precio: 38000,
            tiempo_estimado: '3 a 5 horas',
            stock: 10,
            descripcion: 'Limpieza integral con aire comprimido ionizado, cambio de pasta térmica de alto rendimiento Arctic MX-4 / Thermal Grizzly y thermal pads.',
            palabras_clave: ['mantenimiento', 'termico', 'pasta termica', 'temperatura', 'cooler', 'limpieza', 'gamer', 'notebook', 'pc', 'ruido'],
            activo: true,
          },
          {
            nombre: 'Reparación Puerto HDMI PlayStation 5',
            modelo: 'Sony PlayStation 5',
            categoria: 'Consolas',
            precio: 65000,
            tiempo_estimado: '24 a 48 hs',
            stock: 4,
            descripcion: 'Reemplazo de conector HDMI 2.1 original reforzado con estación de microsoldadura y comprobación con analizador de señal 4K/120Hz.',
            palabras_clave: ['hdmi', 'ps5', 'playstation', 'sin imagen', 'pantalla negra', 'consola', 'luz azul'],
            activo: true,
          },
          {
            nombre: 'Reparación Placa Base / Corto en Línea Principal',
            modelo: 'Multimarca / Apple / ASUS / Lenovo',
            categoria: 'Microelectrónica',
            precio: 92000,
            tiempo_estimado: '48 a 72 hs',
            stock: 8,
            descripcion: 'Detección termográfica con cámara térmica, inyección controlada de tensión y sustitución de circuitos integrados PMIC, MOSFETs y capacitores SMD en corto.',
            palabras_clave: ['placa', 'motherboard', 'corto', 'no enciende', 'microelectronica', 'mosfet', 'reballing', 'muerto'],
            activo: true,
          },
          {
            nombre: 'Cambio Batería Original Samsung Galaxy Serie S / A',
            modelo: 'Samsung Galaxy S20 / S21 / S22 / A52 / A54',
            categoria: 'Smartphones',
            precio: 34000,
            tiempo_estimado: '1 a 2 horas',
            stock: 9,
            descripcion: 'Instalación de batería de litio original nueva con prueba de ciclos de vida útil y calibración de curva de voltaje en software.',
            palabras_clave: ['bateria', 'samsung', 'bateria agotada', 'no dura la carga', 'galaxy', 'hinchada'],
            activo: true,
          },
          {
            nombre: 'Upgrade SSD NVMe 1TB + Instalación SO y Backup',
            modelo: 'Notebooks y PCs compatibles NVMe',
            categoria: 'Notebooks & PC',
            precio: 78000,
            tiempo_estimado: '3 a 4 horas',
            stock: 7,
            descripcion: 'Instalación de unidad de estado sólido NVMe ultra rápida de 1TB, clonación segura o instalación limpia de sistema operativo y migración de datos.',
            palabras_clave: ['disco', 'ssd', 'nvme', 'upgrade', 'lenta', 'formateo', 'windows', 'backup', 'memoria'],
            activo: true,
          },
        ];

        for (const item of initialSeeds) {
          await this.create(item, { id: 'system-seed', role: 'admin' });
        }
        this.logger.log(`Seeded ${initialSeeds.length} default catalog services.`);
      }
    } catch (err: unknown) {
      this.logger.warn(`Could not seed initial catalog items: ${(err as Error).message}`);
    }
  }

  async count(): Promise<number> {
    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.count) {
        return await delegate.count();
      }
    } catch {
      // Fallback
    }

    try {
      const res: any = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "catalog_items"`);
      return Number(res[0]?.count || 0);
    } catch {
      return 0;
    }
  }

  async findAll(filter?: { active?: boolean; category?: string }): Promise<CatalogItemEntity[]> {
    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.findMany) {
        const where: any = {};
        if (filter?.active !== undefined) {
          where.activo = filter.active;
        }
        if (filter?.category) {
          where.categoria = { equals: filter.category, mode: 'insensitive' };
        }
        return await delegate.findMany({
          where,
          orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
        });
      }
    } catch {
      // Fallback to raw SQL below
    }

    try {
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let pIdx = 1;

      if (filter?.active !== undefined) {
        conditions.push(`"activo" = $${pIdx++}`);
        params.push(filter.active);
      }
      if (filter?.category) {
        conditions.push(`LOWER("categoria") = LOWER($${pIdx++})`);
        params.push(filter.category);
      }

      const whereClause = conditions.join(' AND ');
      const rows: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "nombre", "modelo", "categoria", "precio", "tiempo_estimado", "stock", "descripcion", "palabras_clave", "activo", "creado_en", "actualizado_en"
         FROM "catalog_items"
         WHERE ${whereClause}
         ORDER BY "categoria" ASC, "nombre" ASC`,
        ...params,
      );
      return rows || [];
    } catch (err) {
      this.logger.error(`Error querying catalog items: ${(err as Error).message}`);
      return [];
    }
  }

  async findById(id: string): Promise<CatalogItemEntity> {
    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.findUnique) {
        const item = await delegate.findUnique({ where: { id } });
        if (item) return item;
      }
    } catch {
      // Fallback
    }

    try {
      const rows: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "nombre", "modelo", "categoria", "precio", "tiempo_estimado", "stock", "descripcion", "palabras_clave", "activo", "creado_en", "actualizado_en"
         FROM "catalog_items" WHERE "id" = $1 LIMIT 1`,
        id,
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch {
      // Fallback
    }

    throw new NotFoundException(`Servicio de catálogo con ID "${id}" no encontrado`);
  }

  async create(
    dto: CreateCatalogItemDto,
    user?: { id?: string; role?: string },
  ): Promise<CatalogItemEntity> {
    const id = randomUUID();
    const now = new Date();
    const palabrasClave = Array.isArray(dto.palabras_clave)
      ? dto.palabras_clave.map((p) => String(p).trim()).filter(Boolean)
      : [];

    let item: CatalogItemEntity | null = null;

    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.create) {
        item = await delegate.create({
          data: {
            id,
            nombre: dto.nombre,
            modelo: dto.modelo || null,
            categoria: dto.categoria,
            precio: Number(dto.precio),
            tiempo_estimado: dto.tiempo_estimado,
            stock: Number(dto.stock ?? 0),
            descripcion: dto.descripcion,
            palabras_clave: palabrasClave,
            activo: dto.activo !== undefined ? Boolean(dto.activo) : true,
            creado_en: now,
            actualizado_en: now,
          },
        });
      }
    } catch {
      // Fallback
    }

    if (!item) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "catalog_items" ("id", "nombre", "modelo", "categoria", "precio", "tiempo_estimado", "stock", "descripcion", "palabras_clave", "activo", "creado_en", "actualizado_en")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        id,
        dto.nombre,
        dto.modelo || null,
        dto.categoria,
        Number(dto.precio),
        dto.tiempo_estimado,
        Number(dto.stock ?? 0),
        dto.descripcion,
        palabrasClave,
        dto.activo !== undefined ? Boolean(dto.activo) : true,
        now,
        now,
      );

      item = {
        id,
        nombre: dto.nombre,
        modelo: dto.modelo || null,
        categoria: dto.categoria,
        precio: Number(dto.precio),
        tiempo_estimado: dto.tiempo_estimado,
        stock: Number(dto.stock ?? 0),
        descripcion: dto.descripcion,
        palabras_clave: palabrasClave,
        activo: dto.activo !== undefined ? Boolean(dto.activo) : true,
        creado_en: now,
        actualizado_en: now,
      };
    }

    // Audit log
    await this.auditService.logAction({
      userId: user?.id ?? null,
      role: user?.role ?? null,
      action: 'CATALOG_ITEM_CREATED',
      entity: 'CATALOG_ITEM',
      entityId: item.id,
      metadata: {
        nombre: item.nombre,
        modelo: item.modelo,
        categoria: item.categoria,
        precio: item.precio,
        stock: item.stock,
      },
    });

    return item;
  }

  async update(
    id: string,
    dto: UpdateCatalogItemDto,
    user?: { id?: string; role?: string },
  ): Promise<CatalogItemEntity> {
    const existing = await this.findById(id);
    const now = new Date();

    const dataToUpdate: any = {
      actualizado_en: now,
    };
    if (dto.nombre !== undefined) dataToUpdate.nombre = dto.nombre;
    if (dto.modelo !== undefined) dataToUpdate.modelo = dto.modelo || null;
    if (dto.categoria !== undefined) dataToUpdate.categoria = dto.categoria;
    if (dto.precio !== undefined) dataToUpdate.precio = Number(dto.precio);
    if (dto.tiempo_estimado !== undefined) dataToUpdate.tiempo_estimado = dto.tiempo_estimado;
    if (dto.stock !== undefined) dataToUpdate.stock = Number(dto.stock);
    if (dto.descripcion !== undefined) dataToUpdate.descripcion = dto.descripcion;
    if (dto.palabras_clave !== undefined) {
      dataToUpdate.palabras_clave = Array.isArray(dto.palabras_clave)
        ? dto.palabras_clave.map((p) => String(p).trim()).filter(Boolean)
        : [];
    }
    if (dto.activo !== undefined) dataToUpdate.activo = Boolean(dto.activo);

    let updated: CatalogItemEntity | null = null;

    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.update) {
        updated = await delegate.update({
          where: { id },
          data: dataToUpdate,
        });
      }
    } catch {
      // Fallback
    }

    if (!updated) {
      const sets: string[] = ['"actualizado_en" = $1'];
      const params: any[] = [now];
      let pIdx = 2;

      if (dto.nombre !== undefined) {
        sets.push(`"nombre" = $${pIdx++}`);
        params.push(dto.nombre);
      }
      if (dto.modelo !== undefined) {
        sets.push(`"modelo" = $${pIdx++}`);
        params.push(dto.modelo || null);
      }
      if (dto.categoria !== undefined) {
        sets.push(`"categoria" = $${pIdx++}`);
        params.push(dto.categoria);
      }
      if (dto.precio !== undefined) {
        sets.push(`"precio" = $${pIdx++}`);
        params.push(Number(dto.precio));
      }
      if (dto.tiempo_estimado !== undefined) {
        sets.push(`"tiempo_estimado" = $${pIdx++}`);
        params.push(dto.tiempo_estimado);
      }
      if (dto.stock !== undefined) {
        sets.push(`"stock" = $${pIdx++}`);
        params.push(Number(dto.stock));
      }
      if (dto.descripcion !== undefined) {
        sets.push(`"descripcion" = $${pIdx++}`);
        params.push(dto.descripcion);
      }
      if (dto.palabras_clave !== undefined) {
        sets.push(`"palabras_clave" = $${pIdx++}`);
        params.push(dataToUpdate.palabras_clave);
      }
      if (dto.activo !== undefined) {
        sets.push(`"activo" = $${pIdx++}`);
        params.push(Boolean(dto.activo));
      }

      params.push(id);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "catalog_items" SET ${sets.join(', ')} WHERE "id" = $${pIdx}`,
        ...params,
      );

      updated = await this.findById(id);
    }

    // Audit log
    await this.auditService.logAction({
      userId: user?.id ?? null,
      role: user?.role ?? null,
      action: 'CATALOG_ITEM_UPDATED',
      entity: 'CATALOG_ITEM',
      entityId: id,
      metadata: {
        previous: {
          nombre: existing.nombre,
          precio: existing.precio,
          stock: existing.stock,
          activo: existing.activo,
        },
        changes: dto,
      },
    });

    return updated!;
  }

  async delete(id: string, user?: { id?: string; role?: string }): Promise<{ ok: boolean; id: string }> {
    const existing = await this.findById(id);

    try {
      const delegate = (this.prisma as any).catalogItem;
      if (delegate?.delete) {
        await delegate.delete({ where: { id } });
      } else {
        await this.prisma.$executeRawUnsafe(`DELETE FROM "catalog_items" WHERE "id" = $1`, id);
      }
    } catch {
      await this.prisma.$executeRawUnsafe(`DELETE FROM "catalog_items" WHERE "id" = $1`, id);
    }

    // Audit log
    await this.auditService.logAction({
      userId: user?.id ?? null,
      role: user?.role ?? null,
      action: 'CATALOG_ITEM_DELETED',
      entity: 'CATALOG_ITEM',
      entityId: id,
      metadata: {
        deletedItem: {
          nombre: existing.nombre,
          modelo: existing.modelo,
          categoria: existing.categoria,
          precio: existing.precio,
        },
      },
    });

    return { ok: true, id };
  }

  async search(query: string): Promise<CatalogItemEntity[]> {
    if (!query || !query.trim()) {
      return this.findAll({ active: true });
    }

    const items = await this.findAll({ active: true });
    const cleanQuery = query.toLowerCase().trim();
    const terms = cleanQuery
      .split(/[\s,.;:?!+/'"()-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    if (terms.length === 0) {
      return items;
    }

    // Score items based on relevance
    const scored = items
      .map((item) => {
        const nombreLower = item.nombre.toLowerCase();
        const modeloLower = (item.modelo || '').toLowerCase();
        const categoriaLower = item.categoria.toLowerCase();
        const descripcionLower = item.descripcion.toLowerCase();
        const keywordsLower = (item.palabras_clave || []).map((k) => k.toLowerCase());

        let score = 0;

        // Exact match with whole query
        if (nombreLower.includes(cleanQuery)) score += 15;
        if (modeloLower && modeloLower.includes(cleanQuery)) score += 15;

        for (const term of terms) {
          if (modeloLower && modeloLower.includes(term)) score += 6;
          if (nombreLower.includes(term)) score += 5;
          if (keywordsLower.some((k) => k.includes(term) || term.includes(k))) score += 4;
          if (categoriaLower.includes(term)) score += 2;
          if (descripcionLower.includes(term)) score += 1;
        }

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    return scored;
  }
}
