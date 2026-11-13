import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);
  private model: ChatGoogleGenerativeAI | null = null;
  public readonly isGeminiConfigured: boolean = false;

  constructor(
    private prisma: PrismaService,
    private catalogService: CatalogService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (apiKey && apiKey.trim() !== '') {
      try {
        this.model = new ChatGoogleGenerativeAI({
          apiKey,
          model: modelName,
          temperature: 0.2,
        });
        this.isGeminiConfigured = true;
        this.logger.log(
          `Gemini AI inicializado correctamente con el modelo "${modelName}".`,
        );
      } catch (err) {
        this.logger.warn(
          `No se pudo inicializar ChatGoogleGenerativeAI: ${(err as Error).message}`,
        );
        this.model = null;
        this.isGeminiConfigured = false;
      }
    } else {
      this.logger.log(
        'GEMINI_API_KEY no configurada (o vacía). El asistente opera en modo de respaldo heurístico local (sin llamadas externas).',
      );
      this.model = null;
      this.isGeminiConfigured = false;
    }
  }

  /**
   * 1. Agente de Atención al Cliente (Cotizador Inteligente con Catálogo).
   * Por seguridad y privacidad, el chat público cotiza servicios oficiales y stock,
   * pero NO expone datos privados de reparaciones sin autorización.
   */
  async handleCustomerMessage(
    tenantId?: string,
    message: string = '',
    _customerDni?: string,
  ) {
    // 1. Búsqueda de servicios en catálogo oficial en tiempo real
    const matchingCatalogItems = await this.catalogService.search(message);

    const formattedCatalogContext =
      matchingCatalogItems.length > 0
        ? matchingCatalogItems.map((item) => ({
            servicio: item.nombre,
            modelo_aplicable: item.modelo,
            categoria: item.categoria,
            precio_ars: item.precio,
            tiempo_estimado: item.tiempo_estimado,
            stock_unidades: item.stock,
            disponibilidad:
              item.stock > 0
                ? `En Stock (${item.stock} unidades en taller)`
                : 'Sin Stock inmediato (ingreso a pedido en 24 a 48 hs)',
            descripcion: item.descripcion,
          }))
        : [];

    // Verificamos si el usuario está consultando por reparaciones privadas
    const isAskingAboutPrivateStatus =
      /(estado|orden|reparaci[oó]n|seguimiento|c[oó]mo va mi|mi equipo|dni)/i.test(
        message,
      );

    const prompt = `
      Eres el asistente técnico virtual oficial de nuestro taller de reparaciones de tecnología ElectroFix.
      Responde de forma concisa, cálida, profesional y de confianza (español rioplatense sutil o neutro).

      CATÁLOGO DE PRECIOS OFICIALES Y STOCK EN TIEMPO REAL:
      ${formattedCatalogContext.length > 0 ? JSON.stringify(formattedCatalogContext, null, 2) : 'No se encontraron coincidencias exactas en el catálogo.'}

      REGLAS ESTRICTAS DE SEGURIDAD Y RESPUESTA:
      1. Si el problema o equipo del cliente coincide con un servicio del CATÁLOGO DE PRECIOS OFICIALES, cotiza el precio exacto real (en pesos argentinos formato $XX.XXX), el tiempo estimado y la disponibilidad real de stock.
      2. Si NO hay coincidencia exacta en el catálogo, proporciona una estimación prudente y segura aclarando explícitamente que se trata de un presupuesto estimativo orientativo, e invita al cliente a acercar el equipo a nuestro taller para una revisión y diagnóstico técnico presencial sin cargo.
      3. NUNCA inventes stock ni confirmes repuestos inexistentes.
      4. NUNCA expongas IDs de base de datos, tokens internos ni nombres de tablas.
      5. PRIVACIDAD: Si el cliente pregunta por el estado de una reparación particular o ingresa un DNI en este chat público abierto, indícale cordialmente que por razones de privacidad y protección de datos, el estado de reparaciones debe consultarse exclusivamente en la sección de Seguimiento con su código/token de orden (TRK-XXXX). NUNCA devuelvas datos personales de reparaciones por el chat público.
      6. Si el equipo sufrió ingreso de líquido o humedad, recuérdale con urgencia no intentar encenderlo ni conectarlo al cargador para evitar cortocircuitos irreversibles en placa.

      MENSAJE DEL CLIENTE: "${message}"
    `;

    if (this.model) {
      try {
        const response = await this.model.invoke(prompt);
        const reply =
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        return {
          reply: reply.trim(),
          source: 'gemini',
          isAiGenerated: true,
        };
      } catch (error) {
        this.logger.error(
          'Error invoking Gemini in handleCustomerMessage',
          error,
        );
      }
    }

    // Respuesta heurística de respaldo local cuando Gemini no está configurado o falla
    if (
      isAskingAboutPrivateStatus &&
      !message.toLowerCase().includes('cuanto') &&
      !message.toLowerCase().includes('precio')
    ) {
      return {
        reply:
          '¡Hola! Por cuestiones de privacidad y seguridad, los datos y el estado de reparaciones no se difunden en el chat público abierto. Podés consultar tu orden con tu código de seguimiento (ej: TRK-XXXX) desde nuestra sección de Seguimiento oficial.',
        source: 'heuristic_fallback',
        isAiGenerated: false,
      };
    }

    if (matchingCatalogItems.length > 0) {
      const top = matchingCatalogItems[0];
      const stockMsg =
        top.stock > 0
          ? `Tenemos repuestos en stock (${top.stock} u.)`
          : 'El repuesto se solicita a pedido (24-48 hs)';
      return {
        reply: `¡Hola! Para ${top.nombre}${top.modelo ? ` (${top.modelo})` : ''}, el valor de lista oficial es de $${top.precio.toLocaleString('es-AR')}, con un tiempo estimado de trabajo de ${top.tiempo_estimado}. ${stockMsg}. ${top.descripcion} ¡Podés traer el equipo a nuestro taller para ingresarlo a laboratorio!`,
        source: 'heuristic_fallback',
        isAiGenerated: false,
      };
    }

    return {
      reply:
        '¡Hola! Gracias por consultarnos. Para esa falla o modelo en particular, te invitamos a traer el equipo a nuestro taller para revisarlo en laboratorio y brindarte un diagnóstico y presupuesto exacto sin cargo.',
      source: 'heuristic_fallback',
      isAiGenerated: false,
    };
  }

  async chat(
    message: string,
    _history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    tenantId?: string,
    customerDni?: string,
  ) {
    return this.handleCustomerMessage(tenantId, message, customerDni);
  }

  // 2. Copiloto para el Técnico: Limpia notas de banco de trabajo
  async formatTechNoteForCustomer(
    rawNote: string,
    device: string = 'Equipo del cliente',
  ) {
    if (!rawNote || !rawNote.trim()) {
      return {
        cleanReport: '',
        cleanedReport: '',
        source: 'heuristic_fallback',
        isAiGenerated: false,
      };
    }

    const prompt = `
      Actúa como un jefe de laboratorio electrónico de alta gama. Convierte este apunte rápido de un técnico sobre un "${device}" en un informe breve, claro y profesional para que el cliente lo lea en su seguimiento web y justifique el valor del trabajo:
      Apunte crudo: "${rawNote}"

      Estructura sugerida:
      - Diagnóstico y estado inicial
      - Procedimientos técnicos realizados
      - Pruebas y verificación de control de calidad superadas

      Devuelve solo el texto del informe técnico formateado.
    `;

    if (this.model) {
      try {
        const response = await this.model.invoke(prompt);
        const text =
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        const trimmed = text.trim();
        return {
          cleanReport: trimmed,
          cleanedReport: trimmed,
          source: 'gemini',
          isAiGenerated: true,
        };
      } catch (error) {
        this.logger.error(
          'Error invoking Gemini in formatTechNoteForCustomer',
          error,
        );
      }
    }

    const fallback = `Informe Técnico: Se realizó la intervención técnica sobre el equipo (${device}). Procedimientos efectuados: ${rawNote}. Pruebas de funcionamiento y verificación superadas.`;
    return {
      cleanReport: fallback,
      cleanedReport: fallback,
      source: 'heuristic_fallback',
      isAiGenerated: false,
    };
  }

  async cleanNote(rawNotes: string, device?: string) {
    return this.formatTechNoteForCustomer(rawNotes, device);
  }
}
