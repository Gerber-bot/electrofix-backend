export class CreateCatalogItemDto {
  nombre: string;
  modelo?: string | null;
  categoria: string;
  precio: number;
  tiempo_estimado: string;
  stock: number;
  descripcion: string;
  palabras_clave: string[];
  activo?: boolean;
}
