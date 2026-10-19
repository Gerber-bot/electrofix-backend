import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth.middleware';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('search')
  async search(@Query('q') q?: string) {
    return this.catalogService.search(q || '');
  }

  @Get(['', 'items'])
  async findAll(
    @Query('active') active?: string,
    @Query('category') category?: string,
  ) {
    const activeBool = active !== undefined ? active === 'true' : undefined;
    return this.catalogService.findAll({ active: activeBool, category });
  }

  @Get([':id', 'items/:id'])
  async findById(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  @Post(['', 'items'])
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller')
  async create(@Body() dto: CreateCatalogItemDto, @Req() req: Request) {
    if (!dto.nombre || !dto.categoria || dto.precio === undefined || !dto.tiempo_estimado) {
      throw new BadRequestException('Faltan campos obligatorios: nombre, categoría, precio o tiempo estimado');
    }
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.catalogService.create(dto, user ? { id: user.id, role: user.role } : undefined);
  }

  @Patch([':id', 'items/:id'])
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.catalogService.update(id, dto, user ? { id: user.id, role: user.role } : undefined);
  }

  @Delete([':id', 'items/:id'])
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.catalogService.delete(id, user ? { id: user.id, role: user.role } : undefined);
  }
}
