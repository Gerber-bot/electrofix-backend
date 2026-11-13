# ElectroFix Backend (NestJS + Prisma + SQLite)

Backend de gestión para talleres de reparación de electrónica, microelectrónica y servicio técnico, adaptado para ejecución 100% local con SQLite y Prisma ORM.

> **Repositorio Frontend vinculado:** [ElectroFix Frontend](../electrofix-frontend)  
> **Acceso directo al Asistente Técnico y Cotizador IA:** [`src/ai/ai.service.ts`](./src/ai/ai.service.ts) y [`src/ai/ai.controller.ts`](./src/ai/ai.controller.ts)

---

## 🚀 Puesta en Marcha (Clon Limpio)

### 1. Requisitos
- Node.js v20+ (probado en v24)
- npm v10+

### 2. Variables de Entorno
Copia el archivo de ejemplo para generar la configuración local:
```bash
cp .env.example .env
```
Contenido predeterminado de `.env`:
```ini
DATABASE_URL="file:./dev.db"
JWT_SECRET="electrofix-super-secret-local-jwt-key-32chars"
PORT=3001
# GEMINI_API_KEY es opcional. Si se omite o está vacía, el cotizador opera en modo de respaldo heurístico local.
GEMINI_API_KEY=""
```

### 3. Instalación de dependencias
```bash
npm install
```

### 4. Inicialización de la base de datos y migraciones
Crea la base de datos SQLite y sincroniza las tablas:
```bash
npx prisma migrate dev --name init_sqlite
```

### 5. Carga de datos iniciales reproducibles (Seed)
Puebla dos talleres independientes, usuarios con contraseñas encriptadas con `bcrypt`, catálogo oficial y reparaciones de ejemplo:
```bash
npm run seed
```

### 6. Levantar el servidor
```bash
# Modo desarrollo con auto-reload
npm run start:dev

# O compilación y ejecución directa
npm run build
npm run start:prod
```
El servidor quedará escuchando en `http://localhost:3001`.

---

## 👥 Usuarios de Prueba Precargados

| Rol | Email | Contraseña | Taller / Alcance |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@electrofix.local` | `Admin123!` | Global (Métricas, Auditoría, Usuarios) |
| **Encargado Taller Centro** | `taller1@electrofix.local` | `Taller123!` | ElectroFix Centro (`tenant-centro`) |
| **Técnico Taller Centro** | `tecnico1@electrofix.local` | `Tecnico123!` | ElectroFix Centro (`tenant-centro`) |
| **Encargado Taller Norte** | `taller2@electrofix.local` | `Taller123!` | ElectroFix Norte (`tenant-norte`) |
| **Técnico Taller Norte** | `tecnico2@electrofix.local` | `Tecnico123!` | ElectroFix Norte (`tenant-norte`) |

---

## 🔒 Decisiones de Arquitectura y Persistencia SQLite

1. **Persistencia SQLite con Prisma**:
   - `palabras_clave` en el catálogo se almacena como un string serializado en formato JSON para SQLite, conservando transparentemente la interfaz tipada `string[]` hacia controladores y frontend.
   - Las búsquedas de texto fueron adaptadas evitando modificadores no soportados como `mode: 'insensitive'`, aprovechando la insensibilidad predeterminada de SQLite para caracteres ASCII.
   - La numeración correlativa de órdenes (`orderNumber`) se calcula incrementalmente a nivel de servicio para no depender de secuencias de PostgreSQL (`autoincrement()` en campos no clave).
2. **Autenticación Local Desacoplada**:
   - Totalmente independiente de Supabase.
   - Las contraseñas se almacenan con hash `bcrypt` (10 rounds) en la tabla local `users`.
   - Se emiten y validan tokens JWT firmados con `JWT_SECRET`.
   - Se eliminaron las cabeceras de bypass de desarrollo (`x-dev-role`) y cualquier desactivación condicional de permisos.
3. **Aislamiento Multi-Taller (Multi-Tenant)**:
   - El rol y el taller del usuario se derivan **estrictamente de la sesión validada en el servidor**.
   - Los usuarios de taller solo pueden leer y modificar los tickets de su propio taller. Intentar acceder o editar una reparación ajena devuelve `403 Forbidden`.
   - El aislamiento está implementado como control de acceso a nivel de aplicación en NestJS (no se presenta como RLS).
4. **Asistente Virtual y Cotizador**:
   - Acceso al código: [`src/ai/ai.service.ts`](./src/ai/ai.service.ts).
   - **Gemini opcional**: si no se configura `GEMINI_API_KEY`, el sistema inicia normalmente y utiliza un algoritmo heurístico local que cotiza basándose en los ítems y precios reales del catálogo.
   - **Privacidad estricta**: el chat público cotiza servicios y explica procedimientos, pero **no divulga diagnósticos ni datos privados de clientes** ante consultas con DNI; instruye al cliente a utilizar su código de seguimiento individual en la sección correspondiente.
5. **Limitaciones Locales Documentadas**:
   - El envío de correos salientes (invitaciones a nuevos técnicos) está deshabilitado en modo local. La API genera los tokens de invitación válidos para su aceptación directa vía URL.

---

## 🧪 Pruebas Automatizadas

```bash
# Pruebas unitarias
npm test

# Suite E2E de validación (incluye control de acceso, aislamiento multi-taller y cotizador)
npm run test:e2e

# Compilación y chequeo de tipos
npm run build

# Verificación de linter
npm run lint
```
